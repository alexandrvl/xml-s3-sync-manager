from functools import lru_cache
import logging

from fastapi import Depends

from app.config import Settings, get_settings
from app.s3_store import S3Store

logger = logging.getLogger("uvicorn.error")

_s3_last_error: str | None = None


def s3_last_error() -> str | None:
    return _s3_last_error


def record_s3_ok() -> None:
    global _s3_last_error
    _s3_last_error = None


def record_s3_error(message: str) -> None:
    global _s3_last_error
    _s3_last_error = message
    logger.error("S3 unavailable: %s", message)


@lru_cache
def _s3_store(
    endpoint: str,
    access_key: str,
    secret_key: str,
    bucket: str,
    region: str,
    addressing: str,
    ca_bundle: str,
    client_cert: str,
    client_key: str,
) -> S3Store:
    settings = get_settings()
    return S3Store(settings)


def get_s3(settings: Settings = Depends(get_settings)) -> S3Store:
    store = _s3_store(
        settings.s3_endpoint,
        settings.s3_access_key,
        settings.s3_secret_key,
        settings.s3_bucket,
        settings.s3_region,
        settings.s3_addressing_style,
        settings.s3_ca_bundle,
        settings.s3_client_cert,
        settings.s3_client_key,
    )
    try:
        store.ensure_bucket()
        record_s3_ok()
    except Exception as exc:
        record_s3_error(str(exc))
    return store


def probe_s3(store: S3Store) -> bool:
    try:
        store.client.head_bucket(Bucket=store.bucket)
        record_s3_ok()
        return True
    except Exception as exc:
        record_s3_error(str(exc))
        return False
