from fastapi.testclient import TestClient

from app.main import app
from app.workspace import validate_inbound_object_key, validate_object_key
import pytest

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_auth_config_public() -> None:
    response = client.get("/api/v1/auth/config")
    assert response.status_code == 200
    body = response.json()
    assert "enabled" in body
    assert "clientId" in body
    assert "redirectUri" in body


def test_protected_without_token() -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_validate_object_key() -> None:
    assert validate_object_key("folder/file.xml") == "folder/file.xml"
    assert validate_object_key("OUT/2026/09/07/file.xml") == "OUT/2026/09/07/file.xml"
    with pytest.raises(Exception):
        validate_object_key("../secret")
    with pytest.raises(Exception):
        validate_object_key("/abs")


def test_validate_inbound_object_key() -> None:
    assert validate_inbound_object_key("IN/2026/09/07/file.xml") == "IN/2026/09/07/file.xml"
    with pytest.raises(Exception):
        validate_inbound_object_key("OUT/2026/09/07/file.xml")
    with pytest.raises(Exception):
        validate_inbound_object_key("in/2026/09/07/file.xml")
    with pytest.raises(Exception):
        validate_inbound_object_key("IN")
