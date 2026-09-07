from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import health
from app.spa import attach_spa, resolve_static_dir


def _spa_app(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("<!doctype html><title>spa</title>", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")
    application = FastAPI()
    application.include_router(health.router)
    attach_spa(application, tmp_path)
    return TestClient(application)


def test_spa_serves_index(tmp_path: Path) -> None:
    client = _spa_app(tmp_path)
    response = client.get("/")
    assert response.status_code == 200
    assert "spa" in response.text
    assert "no-cache" in response.headers.get("cache-control", "")


def test_spa_fallback_for_client_routes(tmp_path: Path) -> None:
    client = _spa_app(tmp_path)
    response = client.get("/editor/workspace")
    assert response.status_code == 200
    assert "spa" in response.text


def test_spa_serves_hashed_assets(tmp_path: Path) -> None:
    client = _spa_app(tmp_path)
    response = client.get("/assets/app.js")
    assert response.status_code == 200
    assert "console.log" in response.text
    assert "immutable" in response.headers.get("cache-control", "")


def test_spa_does_not_catch_api_or_health(tmp_path: Path) -> None:
    client = _spa_app(tmp_path)
    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json()["status"] == "ok"
    missing_api = client.get("/api/v1/does-not-exist")
    assert missing_api.status_code == 404
    assert "spa" not in missing_api.text


def test_missing_asset_is_not_index(tmp_path: Path) -> None:
    client = _spa_app(tmp_path)
    response = client.get("/assets/missing.js")
    assert response.status_code == 404


def test_resolve_static_dir_env(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path))
    found = resolve_static_dir()
    assert found == tmp_path.resolve()
