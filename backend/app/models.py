from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field


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
    test_token: str | None = None
    test_email: str | None = None
    test_name: str | None = None


class EntraCodeExchangeRequest(ApiModel):
    code: str
    redirect_uri: str | None = None
    code_verifier: str | None = None


class CreateDocumentRequest(ApiModel):
    file_name: str = Field(min_length=1)
    xml_content: str = Field(min_length=1)


class UpdateDocumentRequest(ApiModel):
    xml_content: str = Field(min_length=1)
    version: int | None = None


class Document(ApiModel):
    id: str
    file_name: str
    file_size: int
    last_modified: str
    version: int
    xml_content: str
    status: Literal["local", "imported", "synced"]
    object_key: str | None = None
    etag: str | None = None
    root_tag: str | None = None


class DocumentSummary(ApiModel):
    id: str
    file_name: str
    file_size: int
    last_modified: str
    version: int
    status: Literal["local", "imported", "synced"]
    object_key: str | None = None
    root_tag: str | None = None


class DocumentList(ApiModel):
    items: list[DocumentSummary]


class CreateChangeRequest(ApiModel):
    change_type: str
    node_path: str
    node_tag: str
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    description: str


class ChangeEntry(ApiModel):
    id: str
    timestamp: str
    user: str
    user_email: str
    node_path: str
    node_tag: str
    change_type: str
    field_name: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    status: str
    sync_id: str | None = None
    description: str


class ChangeList(ApiModel):
    items: list[ChangeEntry]


class PutObjectRequest(ApiModel):
    object_key: str = Field(min_length=1)
    file_name: str
    xml_content: str
    document_id: str | None = None


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


class SyncResultList(ApiModel):
    items: list[SyncResult]


def http_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})
