from __future__ import annotations

from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

XML_CONTENT_MAX = 5 * 1024 * 1024
FILE_NAME_MAX = 255


def to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class ErrorBody(ApiModel):
    code: str
    message: str


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"
    version: str | None = None


UserRole = Literal["Administrator", "Content Editor", "Viewer"]


class User(ApiModel):
    id: str
    name: str
    email: str
    role: UserRole
    auth_provider: str | None = None


class LoginRequest(ApiModel):
    email: str
    password: str = ""


class SessionResponse(ApiModel):
    token: str
    token_type: Literal["Bearer"] = "Bearer"
    expires_in_seconds: int | None = None
    user: User


class EntraPublicConfig(ApiModel):
    enabled: bool
    tenant_id: str
    client_id: str
    authority: str
    redirect_uri: str
    post_logout_redirect_uri: str
    scopes: list[str]
    api_audience: str
    profile: str = "default"
    test_auth_enabled: bool = False
    test_email: str | None = None
    test_name: str | None = None


class EntraCodeExchangeRequest(ApiModel):
    code: str
    redirect_uri: str | None = None
    code_verifier: str | None = None


class PutObjectRequest(ApiModel):
    object_key: str = Field(min_length=1, max_length=1024)
    file_name: str = Field(min_length=1, max_length=FILE_NAME_MAX)
    xml_content: str = Field(min_length=1, max_length=XML_CONTENT_MAX)
    if_match: str | None = None


class StoredObject(ApiModel):
    object_key: str
    file_name: str
    size_bytes: int
    last_modified: str
    etag: str | None = None
    version_id: str | None = None
    storage_uri: str | None = None
    xml_content: str


class StoredObjectSummary(ApiModel):
    object_key: str
    file_name: str
    size_bytes: int
    last_modified: str
    etag: str | None = None
    version_id: str | None = None
    storage_uri: str | None = None


class StoredObjectList(ApiModel):
    items: list[StoredObjectSummary]


class SyncResult(ApiModel):
    sync_id: str
    timestamp: str
    object_key: str
    etag: str | None = None
    version_id: str | None = None
    size_bytes: int
    storage_uri: str | None = None


def http_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})
