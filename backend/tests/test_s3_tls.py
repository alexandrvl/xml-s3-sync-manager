from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from botocore.client import Config

from app.config import Settings, _flatten
from app.s3_store import S3Store, s3_client_cert, s3_verify


def test_s3_verify_default_when_bundle_unset() -> None:
    settings = Settings(s3_ca_bundle="")
    assert s3_verify(settings) is True


def test_s3_verify_uses_configured_ca_file(tmp_path: Path) -> None:
    ca = tmp_path / "enterprise-ca.pem"
    ca.write_text("-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n", encoding="utf-8")
    settings = Settings(s3_ca_bundle=str(ca))
    assert s3_verify(settings) == str(ca.resolve())


def test_s3_verify_missing_ca_file(tmp_path: Path) -> None:
    settings = Settings(s3_ca_bundle=str(tmp_path / "missing.pem"))
    with pytest.raises(FileNotFoundError, match="S3 CA bundle"):
        s3_verify(settings)


def test_s3_client_cert_none_when_unset() -> None:
    assert s3_client_cert(Settings(s3_client_cert="", s3_client_key="")) is None


def test_s3_client_cert_with_separate_key(tmp_path: Path) -> None:
    cert = tmp_path / "client.pem"
    key = tmp_path / "client.key"
    cert.write_text("cert", encoding="utf-8")
    key.write_text("key", encoding="utf-8")
    settings = Settings(s3_client_cert=str(cert), s3_client_key=str(key))
    assert s3_client_cert(settings) == (str(cert.resolve()), str(key.resolve()))


def test_yaml_flatten_s3_tls_paths() -> None:
    data = _flatten(
        {
            "s3": {
                "ca_bundle": "/certs/ca.pem",
                "client_cert": "/certs/client.pem",
                "client_key": "/certs/client.key",
            }
        }
    )
    assert data["s3_ca_bundle"] == "/certs/ca.pem"
    assert data["s3_client_cert"] == "/certs/client.pem"
    assert data["s3_client_key"] == "/certs/client.key"


def test_yaml_flatten_ignores_empty_tls_paths() -> None:
    data = _flatten({"s3": {"ca_bundle": "", "client_cert": "", "client_key": ""}})
    assert "s3_ca_bundle" not in data
    assert "s3_client_cert" not in data
    assert "s3_client_key" not in data


@patch("app.s3_store.boto3.client")
def test_s3_store_passes_verify_true_without_ca(mock_client: MagicMock) -> None:
    mock_client.return_value = MagicMock()
    S3Store(Settings(s3_ca_bundle="", s3_client_cert=""))
    kwargs = mock_client.call_args.kwargs
    assert kwargs["verify"] is True
    config: Config = kwargs["config"]
    assert config.client_cert is None


@patch("app.s3_store.boto3.client")
def test_s3_store_passes_ca_and_client_cert(mock_client: MagicMock, tmp_path: Path) -> None:
    mock_client.return_value = MagicMock()
    ca = tmp_path / "ca.pem"
    cert = tmp_path / "client.pem"
    key = tmp_path / "client.key"
    ca.write_text("ca", encoding="utf-8")
    cert.write_text("cert", encoding="utf-8")
    key.write_text("key", encoding="utf-8")
    S3Store(
        Settings(
            s3_ca_bundle=str(ca),
            s3_client_cert=str(cert),
            s3_client_key=str(key),
        )
    )
    kwargs = mock_client.call_args.kwargs
    assert kwargs["verify"] == str(ca.resolve())
    config: Config = kwargs["config"]
    assert config.client_cert == (str(cert.resolve()), str(key.resolve()))
