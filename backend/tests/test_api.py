from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.object_keys import validate_inbound_object_key, validate_list_prefix, validate_object_key, validate_readable_object_key

client = TestClient(app)


def _login(email: str = "dev@local.test", password: str = "x") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_config_public() -> None:
    response = client.get("/api/v1/auth/config")
    assert response.status_code == 200
    body = response.json()
    assert "enabled" in body
    assert "clientId" in body
    assert "testToken" not in body


def test_protected_without_token() -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_dev_uses_configured_role() -> None:
    token = _login()
    me = client.get("/api/v1/auth/me", headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["role"] == "Administrator"


def test_logout_revokes_token() -> None:
    token = _login()
    assert client.post("/api/v1/auth/logout", headers=_auth(token)).status_code == 204
    assert client.get("/api/v1/auth/me", headers=_auth(token)).status_code == 401


def test_documents_removed() -> None:
    token = _login()
    assert client.get("/api/v1/documents", headers=_auth(token)).status_code == 404
    assert client.get("/api/v1/sync-jobs", headers=_auth(token)).status_code == 404


def test_validate_object_key() -> None:
    assert validate_object_key("folder/file.xml") == "folder/file.xml"
    assert validate_object_key("OUT/2026/09/07/file.xml") == "OUT/2026/09/07/file.xml"
    assert validate_object_key("file..xml") == "file..xml"
    with pytest.raises(Exception):
        validate_object_key("../secret")
    with pytest.raises(Exception):
        validate_object_key("/abs")
    with pytest.raises(Exception):
        validate_object_key("IN/./x.xml")
    with pytest.raises(Exception):
        validate_object_key("IN//x.xml")


def test_validate_inbound_object_key() -> None:
    assert validate_inbound_object_key("IN/2026/09/07/file.xml") == "IN/2026/09/07/file.xml"
    with pytest.raises(Exception):
        validate_inbound_object_key("OUT/2026/09/07/file.xml")
    with pytest.raises(Exception):
        validate_inbound_object_key("in/2026/09/07/file.xml")
    with pytest.raises(Exception):
        validate_inbound_object_key("IN")


def test_validate_readable_and_prefix() -> None:
    assert validate_readable_object_key("OUT/2026/09/07/file.xml").startswith("OUT/")
    with pytest.raises(Exception):
        validate_readable_object_key("secrets/file.xml")
    assert validate_list_prefix(None) == "IN/"
    assert validate_list_prefix("OUT") == "OUT/"
    with pytest.raises(Exception):
        validate_list_prefix("etc/")


def test_put_get_object(fake_s3) -> None:
    token = _login()
    headers = _auth(token)
    put = client.put(
        "/api/v1/objects",
        headers=headers,
        json={
            "objectKey": "IN/2026/09/07/sample.xml",
            "fileName": "sample.xml",
            "xmlContent": "<root><a>1</a></root>",
        },
    )
    assert put.status_code == 200, put.text
    etag = put.json()["etag"]
    listed = client.get("/api/v1/objects", headers=headers, params={"prefix": "IN/"})
    assert listed.status_code == 200
    assert listed.json()["items"][0]["objectKey"] == "IN/2026/09/07/sample.xml"
    got = client.get("/api/v1/objects/content", headers=headers, params={"key": "IN/2026/09/07/sample.xml"})
    assert got.status_code == 200
    assert "<a>1</a>" in got.json()["xmlContent"]
    conflict = client.put(
        "/api/v1/objects",
        headers=headers,
        json={
            "objectKey": "IN/2026/09/07/sample.xml",
            "fileName": "sample.xml",
            "xmlContent": "<root><a>2</a></root>",
            "ifMatch": "wrong",
        },
    )
    assert conflict.status_code == 409
    ok = client.put(
        "/api/v1/objects",
        headers=headers,
        json={
            "objectKey": "IN/2026/09/07/sample.xml",
            "fileName": "sample.xml",
            "xmlContent": "<root><a>2</a></root>",
            "ifMatch": etag,
        },
    )
    assert ok.status_code == 200


def test_put_rejects_outbound_and_malformed(fake_s3) -> None:
    token = _login()
    headers = _auth(token)
    outside = client.put(
        "/api/v1/objects",
        headers=headers,
        json={"objectKey": "OUT/2026/09/07/x.xml", "fileName": "x.xml", "xmlContent": "<root/>"},
    )
    assert outside.status_code == 400
    bad = client.put(
        "/api/v1/objects",
        headers=headers,
        json={"objectKey": "IN/2026/09/07/x.xml", "fileName": "x.xml", "xmlContent": "<root>"},
    )
    assert bad.status_code == 400


def test_get_rejects_unlisted_prefix(fake_s3) -> None:
    token = _login()
    response = client.get(
        "/api/v1/objects/content",
        headers=_auth(token),
        params={"key": "secrets/file.xml"},
    )
    assert response.status_code == 400


def test_non_admin_cannot_put(monkeypatch, fake_s3) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "auth_dev_role", "Viewer")
    token = _login("viewer@local.test")
    response = client.put(
        "/api/v1/objects",
        headers=_auth(token),
        json={"objectKey": "IN/2026/09/07/x.xml", "fileName": "x.xml", "xmlContent": "<root/>"},
    )
    assert response.status_code == 403
    monkeypatch.setattr(settings, "auth_dev_role", "Content Editor")
    editor = _login("editor@local.test")
    response = client.put(
        "/api/v1/objects",
        headers=_auth(editor),
        json={"objectKey": "IN/2026/09/07/x.xml", "fileName": "x.xml", "xmlContent": "<root/>"},
    )
    assert response.status_code == 403


def test_login_forbidden_outside_dev_and_test() -> None:
    from app.config import get_settings

    settings = get_settings()
    original = settings.app_profile
    settings.app_profile = "default"
    try:
        response = client.post("/api/v1/auth/login", json={"email": "a@b.c", "password": "x"})
        assert response.status_code == 400
    finally:
        settings.app_profile = original


def test_default_dev_secret_refused() -> None:
    from app.config import Settings, assert_auth_runtime

    settings = Settings.model_construct(app_profile="dev", auth_dev_secret="dev-only-change-me", entra_auth_enabled=False)
    with pytest.raises(RuntimeError):
        assert_auth_runtime(settings)


def test_viewer_can_read_outbound(monkeypatch, fake_s3) -> None:
    from app.config import get_settings

    fake_s3.objects["OUT/2026/09/07/x.xml"] = {
        "xml": "<root/>",
        "file_name": "x.xml",
        "etag": "e1",
        "size": 7,
    }
    settings = get_settings()
    monkeypatch.setattr(settings, "auth_dev_role", "Viewer")
    token = _login("viewer-out@local.test")
    response = client.get(
        "/api/v1/objects/content",
        headers=_auth(token),
        params={"key": "OUT/2026/09/07/x.xml"},
    )
    assert response.status_code == 200


def test_health_503_when_s3_down(monkeypatch) -> None:
    monkeypatch.setattr("app.routers.health.probe_s3", lambda _store: False)
    response = client.get("/health")
    assert response.status_code == 503
