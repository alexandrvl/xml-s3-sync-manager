from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.auth import (
    create_dev_token,
    exchange_authorization_code,
    get_current_user,
    test_user,
)
from app.config import Settings, get_settings
from app.models import (
    EntraCodeExchangeRequest,
    EntraPublicConfig,
    LoginRequest,
    SessionResponse,
    User,
    http_error,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/config", response_model=EntraPublicConfig)
def auth_config(settings: Settings = Depends(get_settings)) -> EntraPublicConfig:
    test = settings.is_test_profile()
    return EntraPublicConfig(
        enabled=settings.entra_auth_enabled and not test,
        tenant_id=settings.entra_tenant_id,
        client_id=settings.entra_client_id,
        authority=settings.authority_url(),
        redirect_uri=settings.entra_redirect_uri,
        post_logout_redirect_uri=settings.entra_post_logout_redirect_uri,
        scopes=settings.entra_scope_list(),
        api_audience=settings.api_audience(),
        profile="test" if test else settings.app_profile.strip() or "default",
        test_auth_enabled=test,
        test_token=settings.auth_test_token if test else None,
        test_email=settings.auth_test_email if test else None,
        test_name=settings.auth_test_name if test else None,
    )


@router.post("/login", response_model=SessionResponse)
def login(body: LoginRequest, settings: Settings = Depends(get_settings)) -> SessionResponse:
    if settings.entra_auth_enabled and not settings.is_test_profile():
        raise http_error(400, "validation_error", "Use Microsoft Entra ID to sign in.")
    email = body.email.strip().lower()
    if "@" not in email:
        raise http_error(400, "validation_error", "Enter a valid email address.")
    if not body.password:
        raise http_error(400, "validation_error", "Password is required.")
    if settings.is_test_profile():
        test_email = (settings.auth_test_email or "test@local").strip().lower()
        if email == test_email:
            if body.password != settings.auth_test_token:
                raise http_error(401, "unauthorized", "Invalid test user credentials.")
            user = test_user(settings)
            return SessionResponse(
                token=settings.auth_test_token,
                expires_in_seconds=settings.auth_dev_token_minutes * 60,
                user=user,
            )
    name = " ".join(part.capitalize() for part in email.split("@")[0].replace(".", " ").replace("_", " ").split() if part)
    user = User(
        id=f"usr_{email}",
        name=name or "User",
        email=email,
        role="Administrator",
        auth_provider="remote",
    )
    token = create_dev_token(user, settings)
    return SessionResponse(
        token=token,
        expires_in_seconds=settings.auth_dev_token_minutes * 60,
        user=user,
    )


@router.post("/entra/token", response_model=SessionResponse)
def entra_token(body: EntraCodeExchangeRequest, settings: Settings = Depends(get_settings)) -> SessionResponse:
    if not settings.entra_auth_enabled or settings.is_test_profile():
        raise http_error(400, "validation_error", "Entra ID is disabled.")
    from app.auth import decode_entra_token, user_from_claims

    result = exchange_authorization_code(
        body.code,
        body.redirect_uri or settings.entra_redirect_uri,
        body.code_verifier,
        settings,
    )
    token = result["access_token"]
    claims = decode_entra_token(token, settings)
    user = user_from_claims(claims, settings, "entra")
    return SessionResponse(
        token=token,
        expires_in_seconds=int(result["expires_in"]) if result.get("expires_in") else None,
        user=user,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_user: User = Depends(get_current_user)) -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=User)
def me(user: User = Depends(get_current_user)) -> User:
    return user
