from __future__ import annotations

import json
import re
import threading
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

from app.models import (
    ChangeEntry,
    CreateChangeRequest,
    CreateDocumentRequest,
    Document,
    DocumentSummary,
    UpdateDocumentRequest,
    http_error,
)

_ROOT_TAG = re.compile(r"<([A-Za-z_][\w:.-]*)")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def root_tag(xml_content: str) -> str | None:
    try:
        return ET.fromstring(xml_content).tag
    except ET.ParseError:
        match = _ROOT_TAG.search(xml_content)
        return match.group(1) if match else None


INBOUND_ROOT = "IN"


def validate_object_key(object_key: str) -> str:
    key = object_key.strip()
    if not key:
        raise http_error(400, "validation_error", "Enter an object key (destination path).")
    if key.startswith("/") or ".." in key.split("/"):
        raise http_error(400, "validation_error", 'Object key must be a relative path without ".." segments.')
    return key


def is_inbound_object_key(object_key: str) -> bool:
    parts = [part for part in object_key.split("/") if part]
    return len(parts) >= 2 and parts[0] == INBOUND_ROOT


def validate_inbound_object_key(object_key: str) -> str:
    key = validate_object_key(object_key)
    if not is_inbound_object_key(key):
        raise http_error(
            400,
            "validation_error",
            "Object key must be a relative path under IN/ (for example IN/2026/09/07/file.xml).",
        )
    return key


class WorkspaceStore:
    def __init__(self, data_dir: str) -> None:
        self.path = Path(data_dir)
        self.path.mkdir(parents=True, exist_ok=True)
        self.file = self.path / "workspace.json"
        self._lock = threading.Lock()
        self._data = self._load()

    def _load(self) -> dict:
        if not self.file.is_file():
            return {"documents": [], "changes": {}, "sync_jobs": []}
        return json.loads(self.file.read_text(encoding="utf-8"))

    def _save(self) -> None:
        self.file.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

    def create_document(self, request: CreateDocumentRequest) -> Document:
        with self._lock:
            doc = Document(
                id=new_id("doc"),
                file_name=request.file_name,
                file_size=len(request.xml_content.encode("utf-8")),
                last_modified=now_iso(),
                version=1,
                xml_content=request.xml_content,
                status="imported",
                root_tag=root_tag(request.xml_content),
            )
            docs = self._data["documents"]
            docs.insert(0, doc.model_dump(by_alias=False))
            self._save()
            return doc

    def list_documents(self, limit: int, query: str | None) -> list[DocumentSummary]:
        items: list[DocumentSummary] = []
        for raw in self._data["documents"]:
            if query and query.lower() not in str(raw.get("file_name", "")).lower():
                continue
            items.append(
                DocumentSummary(
                    id=raw["id"],
                    file_name=raw["file_name"],
                    file_size=raw["file_size"],
                    last_modified=raw["last_modified"],
                    version=raw["version"],
                    status=raw["status"],
                    object_key=raw.get("object_key"),
                    root_tag=raw.get("root_tag"),
                )
            )
            if len(items) >= limit:
                break
        return items

    def get_document(self, document_id: str) -> Document:
        found = next((d for d in self._data["documents"] if d["id"] == document_id), None)
        if not found:
            raise http_error(404, "not_found", "Document not found.")
        return Document.model_validate(found)

    def update_document(self, document_id: str, request: UpdateDocumentRequest) -> Document:
        with self._lock:
            docs = self._data["documents"]
            idx = next((i for i, d in enumerate(docs) if d["id"] == document_id), -1)
            if idx < 0:
                raise http_error(404, "not_found", "Document not found.")
            current = docs[idx]
            if request.version is not None and request.version != current["version"]:
                raise http_error(409, "conflict", "Document version conflict.")
            updated = {
                **current,
                "xml_content": request.xml_content,
                "file_size": len(request.xml_content.encode("utf-8")),
                "version": current["version"] + 1,
                "last_modified": now_iso(),
                "root_tag": root_tag(request.xml_content),
            }
            docs[idx] = updated
            self._save()
            return Document.model_validate(updated)

    def delete_document(self, document_id: str) -> None:
        with self._lock:
            before = len(self._data["documents"])
            self._data["documents"] = [d for d in self._data["documents"] if d["id"] != document_id]
            if len(self._data["documents"]) == before:
                raise http_error(404, "not_found", "Document not found.")
            self._data["changes"].pop(document_id, None)
            self._save()

    def append_change(self, document_id: str, request: CreateChangeRequest, user_name: str, user_email: str) -> ChangeEntry:
        self.get_document(document_id)
        entry = ChangeEntry(
            id=new_id("chg"),
            timestamp=now_iso(),
            user=user_name,
            user_email=user_email,
            node_path=request.node_path,
            node_tag=request.node_tag,
            change_type=request.change_type,
            field_name=request.field_name,
            old_value=request.old_value,
            new_value=request.new_value,
            status="pending",
            description=request.description,
        )
        with self._lock:
            bucket = self._data["changes"].setdefault(document_id, [])
            bucket.insert(0, entry.model_dump(by_alias=False))
            self._save()
        return entry

    def list_changes(self, document_id: str, limit: int) -> list[ChangeEntry]:
        self.get_document(document_id)
        raw = self._data["changes"].get(document_id, [])[:limit]
        return [ChangeEntry.model_validate(item) for item in raw]

    def mark_synced(self, document_id: str, object_key: str, etag: str | None) -> None:
        with self._lock:
            for doc in self._data["documents"]:
                if doc["id"] == document_id:
                    doc["status"] = "synced"
                    doc["object_key"] = object_key
                    doc["etag"] = etag
                    self._save()
                    return

    def add_sync_job(self, job: dict) -> None:
        with self._lock:
            self._data["sync_jobs"].insert(0, job)
            self._data["sync_jobs"] = self._data["sync_jobs"][:200]
            self._save()

    def list_sync_jobs(self, limit: int) -> list[dict]:
        return self._data["sync_jobs"][:limit]
