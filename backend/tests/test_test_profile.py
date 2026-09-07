from fastapi.testclient import TestClient

from app.config import _config_file, get_settings
from app.main import app
from app.token_denylist import reset_for_tests

client = TestClient(app)


def test_config_file_uses_test_yaml(monkeypatch) -> None:
    monkeypatch.setenv("APP_PROFILE", "test")
    monkeypatch.delenv("APP_CONFIG_FILE", raising=False)
    path = _config_file()
    assert path is not None
    assert path.name == "config.test.yaml"


def test_config_file_prefers_test_yaml_over_default_app_config(monkeypatch, tmp_path) -> None:
    example = tmp_path / "config.yaml"
    test_cfg = tmp_path / "config.test.yaml"
    example.write_text("profile: default\n", encoding="utf-8")
    test_cfg.write_text("profile: test\n", encoding="utf-8")
    monkeypatch.setenv("APP_PROFILE", "test")
    monkeypatch.setenv("APP_CONFIG_FILE", str(example))
    path = _config_file()
    assert path == test_cfg


def test_auth_config_does_not_expose_test_token(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "auth_test_email", "test@local")
    monkeypatch.setattr(settings, "auth_test_name", "Test User")
    monkeypatch.setattr(settings, "entra_auth_enabled", True)
    response = client.get("/api/v1/auth/config")
    assert response.status_code == 200
    body = response.json()
    assert body["profile"] == "test"
    assert body["testAuthEnabled"] is True
    assert "testToken" not in body
    assert body["testEmail"] == "test@local"
    assert body["testName"] == "Test User"
    assert body["enabled"] is False


def test_me_with_test_token(monkeypatch) -> None:
    reset_for_tests()
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "auth_test_email", "test@local")
    monkeypatch.setattr(settings, "auth_test_name", "Test User")
    monkeypatch.setattr(settings, "auth_test_role", "Administrator")
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "test@local"
    assert body["role"] == "Administrator"
    assert body["authProvider"] == "test"


def test_me_rejects_wrong_token_in_test_profile(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-the-token"})
    assert response.status_code == 401


def test_login_test_user_in_test_profile(monkeypatch) -> None:
    reset_for_tests()
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "auth_test_email", "test@local")
    monkeypatch.setattr(settings, "auth_test_name", "Test User")
    monkeypatch.setattr(settings, "auth_test_role", "Administrator")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@local", "password": "test-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token"] == "test-token"
    assert body["user"]["email"] == "test@local"
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer test-token"})
    assert me.status_code == 200


def test_login_test_user_rejects_wrong_password(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "auth_test_email", "test@local")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@local", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_other_email_rejected_in_test_profile(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "entra_auth_enabled", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "e2e@local.dev", "password": "any"},
    )
    assert response.status_code == 401


def test_objects_with_test_token(monkeypatch, fake_s3) -> None:
    reset_for_tests()
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "auth_test_role", "Administrator")
    headers = {"Authorization": "Bearer test-token"}
    created = client.put(
        "/api/v1/objects",
        headers=headers,
        json={"objectKey": "IN/2026/09/07/sample.xml", "fileName": "sample.xml", "xmlContent": "<root><a>1</a></root>"},
    )
    assert created.status_code == 200
    listed = client.get("/api/v1/objects", headers=headers, params={"prefix": "IN/"})
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    assert client.get("/api/v1/documents", headers=headers).status_code == 404
