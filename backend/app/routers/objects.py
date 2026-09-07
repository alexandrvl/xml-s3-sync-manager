from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user, require_admin
from app.deps import get_s3, get_workspace
from app.models import (
    PutObjectRequest,
    StoredObject,
    StoredObjectList,
    SyncResult,
    SyncResultList,
    User,
)
from app.s3_store import S3Store
from app.workspace import WorkspaceStore, new_id, now_iso, validate_inbound_object_key, validate_object_key

router = APIRouter(tags=["Objects"])


@router.get("/objects", response_model=StoredObjectList)
def list_objects(
    prefix: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    s3: S3Store = Depends(get_s3),
) -> StoredObjectList:
    return StoredObjectList(items=s3.list_objects(prefix, limit))


@router.put("/objects", response_model=SyncResult)
def put_object(
    body: PutObjectRequest,
    _admin: User = Depends(require_admin),
    s3: S3Store = Depends(get_s3),
    store: WorkspaceStore = Depends(get_workspace),
) -> SyncResult:
    key = validate_inbound_object_key(body.object_key)
    meta = s3.put_xml(key, body.xml_content, body.file_name)
    if body.document_id:
        store.mark_synced(body.document_id, key, meta.get("etag"))
    result = SyncResult(
        sync_id=new_id("sync"),
        timestamp=now_iso(),
        object_key=key,
        etag=meta.get("etag"),
        version_id=meta.get("version_id"),
        size_bytes=meta["size_bytes"],
        storage_uri=meta.get("storage_uri"),
    )
    store.add_sync_job(result.model_dump(by_alias=False))
    return result


@router.get("/objects/content", response_model=StoredObject)
def get_object(
    key: str = Query(..., min_length=1),
    _user: User = Depends(get_current_user),
    s3: S3Store = Depends(get_s3),
) -> StoredObject:
    return s3.get_xml(validate_object_key(key))


@router.get("/sync-jobs", response_model=SyncResultList)
def list_sync_jobs(
    limit: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    store: WorkspaceStore = Depends(get_workspace),
) -> SyncResultList:
    return SyncResultList(items=[SyncResult.model_validate(item) for item in store.list_sync_jobs(limit)])
