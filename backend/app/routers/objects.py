from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user, require_admin
from app.deps import get_s3
from app.models import (
    PutObjectRequest,
    StoredObject,
    StoredObjectList,
    SyncResult,
    User,
)
from app.object_keys import (
    assert_well_formed_xml,
    new_id,
    now_iso,
    validate_inbound_object_key,
    validate_list_prefix,
    validate_readable_object_key,
)
from app.s3_store import S3Store

router = APIRouter(tags=["Objects"])


def _sync_result_from_object(
    object_key: str,
    *,
    timestamp: str,
    etag: str | None,
    version_id: str | None,
    size_bytes: int,
    storage_uri: str | None,
    sync_id: str | None = None,
) -> SyncResult:
    return SyncResult(
        sync_id=sync_id or etag or f"{object_key}@{timestamp}",
        timestamp=timestamp,
        object_key=object_key,
        etag=etag,
        version_id=version_id,
        size_bytes=size_bytes,
        storage_uri=storage_uri,
    )


@router.get("/objects", response_model=StoredObjectList)
def list_objects(
    prefix: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    s3: S3Store = Depends(get_s3),
) -> StoredObjectList:
    return StoredObjectList(items=s3.list_objects(validate_list_prefix(prefix), limit))


@router.put("/objects", response_model=SyncResult)
def put_object(
    body: PutObjectRequest,
    _admin: User = Depends(require_admin),
    s3: S3Store = Depends(get_s3),
) -> SyncResult:
    key = validate_inbound_object_key(body.object_key)
    assert_well_formed_xml(body.xml_content)
    meta = s3.put_xml(key, body.xml_content, body.file_name, if_match=body.if_match)
    return _sync_result_from_object(
        key,
        timestamp=now_iso(),
        etag=meta.get("etag"),
        version_id=meta.get("version_id"),
        size_bytes=meta["size_bytes"],
        storage_uri=meta.get("storage_uri"),
        sync_id=new_id("sync"),
    )


@router.get("/objects/content", response_model=StoredObject)
def get_object(
    key: str = Query(..., min_length=1),
    _user: User = Depends(get_current_user),
    s3: S3Store = Depends(get_s3),
) -> StoredObject:
    return s3.get_xml(validate_readable_object_key(key))
