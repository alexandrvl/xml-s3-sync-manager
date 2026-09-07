from __future__ import annotations

import uuid
from datetime import datetime, timezone

from defusedxml import ElementTree as ET

from app.models import http_error

INBOUND_ROOT = "IN"
OUTBOUND_ROOT = "OUT"
READ_ROOTS = frozenset({INBOUND_ROOT, OUTBOUND_ROOT})


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def validate_object_key(object_key: str) -> str:
    key = object_key.strip()
    if not key:
        raise http_error(400, "validation_error", "Enter an object key (destination path).")
    if key.startswith("/"):
        raise http_error(400, "validation_error", 'Object key must be a relative path without ".." segments.')
    parts = key.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise http_error(
            400,
            "validation_error",
            'Object key must be a relative path without empty, ".", or ".." segments.',
        )
    return key


def _require_root(key: str, root: str, label: str) -> str:
    key = validate_object_key(key)
    parts = key.split("/")
    if len(parts) < 2 or parts[0] != root:
        raise http_error(
            400,
            "validation_error",
            f"Object key must be a relative path under {root}/ (for example {root}/2026/09/07/file.xml).",
        )
    return key


def validate_inbound_object_key(object_key: str) -> str:
    return _require_root(object_key, INBOUND_ROOT, "inbound")


def validate_readable_object_key(object_key: str) -> str:
    key = validate_object_key(object_key)
    parts = key.split("/")
    if len(parts) < 2 or parts[0] not in READ_ROOTS:
        raise http_error(
            400,
            "validation_error",
            "Object key must be a relative path under IN/ or OUT/.",
        )
    return key


def validate_list_prefix(prefix: str | None) -> str:
    if prefix is None or not prefix.strip():
        return f"{INBOUND_ROOT}/"
    raw = prefix.strip()
    if not raw.endswith("/"):
        raw = f"{raw}/"
    key = raw.rstrip("/")
    parts = key.split("/")
    if any(part in ("", ".", "..") for part in parts) or key.startswith("/"):
        raise http_error(400, "validation_error", "List prefix must be a relative path under IN/ or OUT/.")
    if parts[0] not in READ_ROOTS:
        raise http_error(400, "validation_error", "List prefix must start with IN/ or OUT/.")
    return f"{key}/"


def assert_well_formed_xml(xml_content: str) -> None:
    try:
        ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise http_error(400, "validation_error", "xmlContent is not well-formed XML.") from exc
