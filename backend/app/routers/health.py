from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.deps import get_s3, probe_s3, s3_last_error
from app.models import HealthResponse
from app.s3_store import S3Store

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/api/v1/health", response_model=HealthResponse)
def health(
    settings: Settings = Depends(get_settings),
    s3: S3Store = Depends(get_s3),
) -> HealthResponse:
    if not probe_s3(s3):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "unavailable", "message": s3_last_error() or "Object storage is unreachable."},
        )
    return HealthResponse(status="ok", version=settings.app_version)
