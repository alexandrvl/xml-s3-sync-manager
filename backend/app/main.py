from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.models import XML_CONTENT_MAX
from app.routers import auth, health, objects
from app.spa import attach_spa

settings = get_settings()
MAX_REQUEST_BODY = XML_CONTENT_MAX + 65536

if settings.is_test_profile():
    import logging

    logging.getLogger("uvicorn.error").warning(
        "APP_PROFILE=test is active: a static test bearer token is accepted. Do not use this profile in production."
    )

app = FastAPI(
    title="XML S3 Sync Manager API",
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list() or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    header = request.headers.get("content-length")
    if header:
        try:
            size = int(header)
        except ValueError:
            size = 0
        if size > MAX_REQUEST_BODY:
            return JSONResponse(
                status_code=400,
                content={"code": "validation_error", "message": "Request body is too large."},
            )
    return await call_next(request)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        body = detail
    else:
        code = (
            "unauthorized"
            if exc.status_code == 401
            else "forbidden"
            if exc.status_code == 403
            else "not_found"
            if exc.status_code == 404
            else "unavailable"
            if exc.status_code == 503
            else "error"
        )
        body = {"code": code, "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = []
    for err in exc.errors():
        loc = ".".join(str(part) for part in err.get("loc", ()) if part != "body")
        if loc:
            fields.append(loc)
    message = "Invalid request."
    if fields:
        message = "Invalid request fields: " + ", ".join(fields[:8])
    return JSONResponse(
        status_code=400,
        content={"code": "validation_error", "message": message},
    )


app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(objects.router, prefix="/api/v1")

attach_spa(app, Path(settings.static_dir) if settings.static_dir.strip() else None)
