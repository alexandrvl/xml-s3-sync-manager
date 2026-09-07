from __future__ import annotations

import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

import jwt
import msal
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

from app.config import Settings, get_settings
from app.models import User, UserRole, http_error
from app import token_denylist

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger("uvicorn.error")


def _csv_set(value: str) -> set[str]:
    return {part.strip() for part in value.split(",") if part.strip()}


def map_role(claims: dict[str, Any], settings: Settings) -> UserRole:
    roles: list[str] = []
    raw = claims.get("roles") or claims.get("role") or []
    if isinstance(raw, str):
        roles = [raw]
    elif isinstance(raw, list):
        roles = [str(item) for item in raw]
    admin = _csv_set(settings.entra_admin_roles)
    editor = _csv_set(settings.entra_editor_roles)
    for role in roles:
        if role in admin:
            return "Administrator"
        if role in editor:
            return "Content Editor"
    return "Viewer"


def test_user(settings: Settings) -> User:
    role: UserRole = "Administrator"
    raw_role = settings.auth_test_role.strip()
    if raw_role in ("Administrator", "Content Editor", "Viewer"):
        role = raw_role  # type: ignore[assignment]
    return User(
        id="usr_test",
        name=settings.auth_test_name or "Test User",
        email=settings.auth_test_email or "test@local",
        role=role,
        auth_provider="test",
    )


def user_from_claims(claims: dict[str, Any], settings: Settings, provider: str) -> User:
    email = (
        str(claims.get("email") or claims.get("preferred_username") or claims.get("upn") or "unknown@local")
    )
    name = str(claims.get("name") or email.split("@")[0])
    user_id = str(claims.get("oid") or claims.get("sub") or email)
    return User(
        id=user_id,
        name=name,
        email=email,
        role=map_role(claims, settings),
        auth_provider=provider,
    )


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=300)


def decode_entra_token(token: str, settings: Settings) -> dict[str, Any]:
    audience = settings.api_audience()
    if not audience:
        raise http_error(401, "unauthorized", "Entra ID audience is not configured.")
    try:
        signing_key = _jwks_client(settings.jwks_url()).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=settings.issuer_url(),
        )
    except (InvalidTokenError, ValueError) as exc:
        raise http_error(401, "unauthorized", "Invalid Entra ID token.") from exc


def create_dev_token(user: User, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "oid": user.id,
        "name": user.name,
        "email": user.email,
        "preferred_username": user.email,
        "roles": [user.role],
        "iss": "xml-s3-sync-dev",
        "aud": "xml-s3-sync-dev",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.auth_dev_token_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.auth_dev_secret, algorithm="HS256")


def decode_dev_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.auth_dev_secret,
            algorithms=["HS256"],
            audience="xml-s3-sync-dev",
            issuer="xml-s3-sync-dev",
        )
    except InvalidTokenError as exc:
        raise http_error(401, "unauthorized", "Invalid or expired session token.") from exc


def exchange_authorization_code(code: str, settings: Settings) -> dict[str, Any]:
    if not settings.entra_client_id or not settings.entra_client_secret:
        raise http_error(400, "validation_error", "Confidential client secret is not configured.")
    app = msal.ConfidentialClientApplication(
        client_id=settings.entra_client_id,
        client_credential=settings.entra_client_secret,
        authority=settings.authority_url(),
    )
    scopes = settings.entra_scope_list() or ["openid", "profile", "email"]
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=scopes,
        redirect_uri=settings.entra_redirect_uri,
    )
    if "access_token" not in result:
        raise http_error(401, "unauthorized", "Entra ID token exchange failed.")
    return result


def _reject_if_revoked(token: str, claims: dict[str, Any]) -> None:
    token_id = token_denylist.token_id_from_claims(claims, token)
    if token_denylist.is_revoked(token_id):
        raise http_error(401, "unauthorized", "Session has been signed out.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": "Missing bearer token."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if settings.is_test_profile() and settings.auth_test_token:
        expected = settings.auth_test_token.encode("utf-8")
        provided = token.encode("utf-8")
        if len(expected) == len(provided) and hmac.compare_digest(expected, provided):
            _reject_if_revoked(token, {"jti": f"test:{token_denylist.token_fingerprint(token)}"})
            return test_user(settings)
    if settings.entra_auth_enabled and not settings.is_test_profile():
        claims = decode_entra_token(token, settings)
        _reject_if_revoked(token, claims)
        return user_from_claims(claims, settings, "entra")
    if settings.is_dev_profile() or settings.is_test_profile():
        claims = decode_dev_token(token, settings)
        _reject_if_revoked(token, claims)
        return user_from_claims(claims, settings, "remote")
    raise http_error(401, "unauthorized", "Password login is disabled.")


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "Administrator":
        raise http_error(403, "forbidden", "Only administrators can perform this action.")
    return user


def require_editor(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("Administrator", "Content Editor"):
        raise http_error(403, "forbidden", "Editing requires Administrator or Content Editor.")
    return user


def revoke_current_token(
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> None:
    if credentials is None or not credentials.credentials:
        return
    token = credentials.credentials
    claims: dict[str, Any] = {}
    exp: int | None = None
    try:
        if settings.is_test_profile() and settings.auth_test_token:
            expected = settings.auth_test_token.encode("utf-8")
            provided = token.encode("utf-8")
            if len(expected) == len(provided) and hmac.compare_digest(expected, provided):
                claims = {"jti": f"test:{token_denylist.token_fingerprint(token)}"}
                exp = int((datetime.now(timezone.utc) + timedelta(minutes=settings.auth_dev_token_minutes)).timestamp())
        elif settings.entra_auth_enabled and not settings.is_test_profile():
            claims = decode_entra_token(token, settings)
            raw_exp = claims.get("exp")
            exp = int(raw_exp) if raw_exp else None
        else:
            claims = decode_dev_token(token, settings)
            raw_exp = claims.get("exp")
            exp = int(raw_exp) if raw_exp else None
    except HTTPException:
        return
    token_id = token_denylist.token_id_from_claims(claims, token)
    token_denylist.revoke(token_id, exp)
    logger.info("Access token revoked until expiry on this process.")
