import os

os.environ["APP_PROFILE"] = "dev"
os.environ["AUTH_DEV_SECRET"] = "pytest-auth-dev-secret-not-default"
os.environ["AUTH_DEV_ROLE"] = "Administrator"
os.environ["ENTRA_AUTH_ENABLED"] = "false"

from unittest.mock import MagicMock

import pytest

from app.deps import get_s3
from app.main import app
from app.models import StoredObject, StoredObjectSummary, http_error
from app.s3_store import S3Store


class FakeS3:
    def __init__(self) -> None:
        self.bucket = "xml-sync"
        self.client = MagicMock()
        self.objects: dict[str, dict] = {}

    def ensure_bucket(self) -> None:
        return None

    def put_xml(self, object_key: str, xml_content: str, file_name: str, if_match: str | None = None) -> dict:
        current = self.objects.get(object_key)
        if if_match:
            existing = (current or {}).get("etag")
            if existing != if_match:
                raise http_error(409, "conflict", "Object was modified. Refresh and try again.")
        etag = f"etag-{len(xml_content)}"
        self.objects[object_key] = {
            "xml": xml_content,
            "file_name": file_name,
            "etag": etag,
            "size": len(xml_content.encode("utf-8")),
        }
        return {
            "etag": etag,
            "version_id": "v1",
            "size_bytes": len(xml_content.encode("utf-8")),
            "last_modified": "2026-01-01T00:00:00+00:00",
            "storage_uri": f"s3://xml-sync/{object_key}",
        }

    def get_xml(self, object_key: str) -> StoredObject:
        found = self.objects.get(object_key)
        if not found:
            raise http_error(404, "not_found", f"Object not found: {object_key}")
        return StoredObject(
            object_key=object_key,
            file_name=found["file_name"],
            size_bytes=found["size"],
            last_modified="2026-01-01T00:00:00+00:00",
            etag=found["etag"],
            storage_uri=f"s3://xml-sync/{object_key}",
            xml_content=found["xml"],
        )

    def list_objects(self, prefix: str | None, limit: int) -> list[StoredObjectSummary]:
        items = []
        for key, found in self.objects.items():
            if prefix and not key.startswith(prefix.rstrip("/")) and not key.startswith(prefix):
                continue
            items.append(
                StoredObjectSummary(
                    object_key=key,
                    file_name=found["file_name"],
                    size_bytes=found["size"],
                    last_modified="2026-01-01T00:00:00+00:00",
                    etag=found["etag"],
                    storage_uri=f"s3://xml-sync/{key}",
                )
            )
        return items[:limit]


@pytest.fixture
def fake_s3() -> FakeS3:
    store = FakeS3()
    store.client.head_bucket.return_value = {}
    return store


@pytest.fixture(autouse=True)
def override_s3(fake_s3: FakeS3):
    app.dependency_overrides[get_s3] = lambda: fake_s3
    yield fake_s3
    app.dependency_overrides.pop(get_s3, None)


@pytest.fixture(autouse=True)
def _probe_ok(monkeypatch: pytest.MonkeyPatch, fake_s3: FakeS3) -> None:
    monkeypatch.setattr("app.routers.health.probe_s3", lambda _store: True)
    # Keep type checkers happy that FakeS3 stands in for S3Store in tests.
    assert isinstance(fake_s3, FakeS3) or isinstance(fake_s3, S3Store)
