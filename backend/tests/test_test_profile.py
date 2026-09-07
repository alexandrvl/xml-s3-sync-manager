from fastapi.testclient import TestClient

from app.config import _config_file, get_settings
from app.main import app

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


def test_auth_config_exposes_test_token(monkeypatch) -> None:
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
    assert body["testToken"] == "test-token"
    assert body["testEmail"] == "test@local"
    assert body["testName"] == "Test User"
    assert body["enabled"] is False


def test_me_with_test_token(monkeypatch) -> None:
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
    assert body["user"]["name"] == "Test User"
    assert body["user"]["authProvider"] == "test"
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer test-token"})
    assert me.status_code == 200
    assert me.json()["email"] == "test@local"


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


def test_login_still_works_in_test_profile(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "entra_auth_enabled", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "e2e@local.dev", "password": "any"},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "e2e@local.dev"


def test_documents_with_test_token(monkeypatch, tmp_path) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "app_profile", "test")
    monkeypatch.setattr(settings, "auth_test_token", "test-token")
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    from app.deps import _workspace

    _workspace.cache_clear()
    headers = {"Authorization": "Bearer test-token"}
    created = client.post(
        "/api/v1/documents",
        headers=headers,
        json={"fileName": "sample.xml", "xmlContent": "<root><a>1</a></root>"},
    )
    assert created.status_code == 201
    listed = client.get("/api/v1/documents", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
