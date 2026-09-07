from functools import lru_cache

from fastapi import Depends

from app.config import Settings, get_settings
from app.s3_store import S3Store
from app.workspace import WorkspaceStore


@lru_cache
def _workspace(data_dir: str) -> WorkspaceStore:
    return WorkspaceStore(data_dir)


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
    store = S3Store(settings)
    try:
        store.ensure_bucket()
    except Exception:
        pass
    return store


def get_workspace(settings: Settings = Depends(get_settings)) -> WorkspaceStore:
    return _workspace(settings.data_dir)


def get_s3(settings: Settings = Depends(get_settings)) -> S3Store:
    return _s3_store(
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
