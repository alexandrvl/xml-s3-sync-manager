from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _flatten(raw: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    s3 = raw.get("s3") if isinstance(raw.get("s3"), dict) else {}
    entra = raw.get("entra") if isinstance(raw.get("entra"), dict) else {}
    mapping = {
        "endpoint": "s3_endpoint",
        "access_key": "s3_access_key",
        "secret_key": "s3_secret_key",
        "bucket": "s3_bucket",
        "region": "s3_region",
        "addressing_style": "s3_addressing_style",
        "ca_bundle": "s3_ca_bundle",
        "client_cert": "s3_client_cert",
        "client_key": "s3_client_key",
    }
    for src, dest in mapping.items():
        if s3.get(src) not in (None, ""):
            data[dest] = s3[src]
    entra_map = {
        "enabled": "entra_auth_enabled",
        "tenant_id": "entra_tenant_id",
        "client_id": "entra_client_id",
        "client_secret": "entra_client_secret",
        "authority": "entra_authority",
        "redirect_uri": "entra_redirect_uri",
        "post_logout_redirect_uri": "entra_post_logout_redirect_uri",
        "scopes": "entra_scopes",
        "api_audience": "entra_api_audience",
        "issuer": "entra_issuer",
        "jwks_url": "entra_jwks_url",
        "admin_roles": "entra_admin_roles",
        "editor_roles": "entra_editor_roles",
        "viewer_roles": "entra_viewer_roles",
    }
    for src, dest in entra_map.items():
        if entra.get(src) not in (None, ""):
            data[dest] = entra[src]
    if raw.get("cors_origins"):
        data["cors_origins"] = raw["cors_origins"]
    if raw.get("auth_dev_secret"):
        data["auth_dev_secret"] = raw["auth_dev_secret"]
    if raw.get("data_dir"):
        data["data_dir"] = raw["data_dir"]
    if raw.get("profile"):
        data["app_profile"] = raw["profile"]
    for key in ("auth_test_token", "auth_test_email", "auth_test_name", "auth_test_role"):
        if raw.get(key) not in (None, ""):
            data[key] = raw[key]
    return data


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "xml-s3-sync-manager"
    app_version: str = "1.0.0"
    app_profile: str = "default"
    data_dir: str = "/data"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080"
    static_dir: str = ""

    s3_endpoint: str = "http://seaweedfs-s3:8333"
    s3_access_key: str = "seaweedfs-access-key"
    s3_secret_key: str = "seaweedfs-secret-key"
    s3_bucket: str = "xml-sync"
    s3_region: str = "us-east-1"
    s3_addressing_style: str = "path"
    # Enterprise PKI: PEM CA bundle used to verify the S3 HTTPS endpoint.
    # Empty keeps boto3 defaults (system/certifi CAs). HTTP test endpoints ignore this.
    s3_ca_bundle: str = ""
    # Optional mTLS client certificate (PEM). Pair with s3_client_key if the key is separate.
    s3_client_cert: str = ""
    s3_client_key: str = ""

    entra_auth_enabled: bool = False
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_client_secret: str = ""
    entra_authority: str = ""
    entra_redirect_uri: str = "http://localhost:3000"
    entra_post_logout_redirect_uri: str = "http://localhost:3000"
    entra_scopes: str = "openid profile email"
    entra_api_audience: str = ""
    entra_issuer: str = ""
    entra_jwks_url: str = ""
    entra_admin_roles: str = "Administrator,Admin"
    entra_editor_roles: str = "Content Editor,Editor"
    entra_viewer_roles: str = "Viewer"

    auth_dev_secret: str = Field(default="dev-only-change-me")
    auth_dev_token_minutes: int = 480
    auth_test_token: str = Field(default="test-token")
    auth_test_email: str = "test@local"
    auth_test_name: str = "Test User"
    auth_test_role: str = "Administrator"

    def is_test_profile(self) -> bool:
        return self.app_profile.strip().lower() == "test"

    def cors_origin_list(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]

    def entra_scope_list(self) -> list[str]:
        return [part.strip() for part in self.entra_scopes.split() if part.strip()]

    def authority_url(self) -> str:
        if self.entra_authority.strip():
            return self.entra_authority.rstrip("/")
        tenant = self.entra_tenant_id.strip() or "common"
        return f"https://login.microsoftonline.com/{tenant}"

    def issuer_url(self) -> str:
        if self.entra_issuer.strip():
            return self.entra_issuer.rstrip("/")
        return f"{self.authority_url()}/v2.0"

    def jwks_url(self) -> str:
        if self.entra_jwks_url.strip():
            return self.entra_jwks_url
        tenant = self.entra_tenant_id.strip() or "common"
        return f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"

    def api_audience(self) -> str:
        if self.entra_api_audience.strip():
            return self.entra_api_audience.strip()
        return self.entra_client_id.strip()


def _config_file() -> Path | None:
    backend_dir = Path(__file__).resolve().parent.parent
    explicit = os.environ.get("APP_CONFIG_FILE")
    profile = os.environ.get("APP_PROFILE", "").strip().lower()
    if profile == "test":
        candidates: list[Path] = []
        if explicit:
            path = Path(explicit)
            if path.name == "config.test.yaml":
                candidates.append(path)
            else:
                candidates.append(path.with_name("config.test.yaml"))
        candidates.append(backend_dir / "config.test.yaml")
        for candidate in candidates:
            if candidate.is_file():
                return candidate
    elif explicit:
        candidate = Path(explicit)
        if candidate.is_file():
            return candidate
    else:
        cwd_cfg = Path("config.yaml")
        if cwd_cfg.is_file():
            return cwd_cfg
    example = backend_dir / "config.example.yaml"
    return example if example.is_file() else None


def _yaml_defaults() -> dict[str, Any]:
    candidate = _config_file()
    if candidate is None:
        return {}
    loaded = yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}
    if not isinstance(loaded, dict):
        return {}
    return _flatten(loaded)


@lru_cache
def get_settings() -> Settings:
    defaults = _yaml_defaults()
    for key, value in defaults.items():
        env_key = key.upper()
        os.environ.setdefault(env_key, str(value) if not isinstance(value, bool) else str(value).lower())
    return Settings()
