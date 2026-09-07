from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response

_RESERVED_PREFIXES = (
    "api/",
    "api",
    "docs",
    "redoc",
    "openapi.json",
    "health",
)


def resolve_static_dir(explicit: str | Path | None = None) -> Path | None:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    env = os.environ.get("STATIC_DIR", "").strip()
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve().parent
    candidates.extend(
        [
            Path("/app/static"),
            here.parent / "static",
            here.parent.parent / "frontend" / "dist",
        ]
    )
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve() if candidate.exists() else candidate
        if resolved in seen:
            continue
        seen.add(resolved)
        if (candidate / "index.html").is_file():
            return candidate.resolve()
    return None


def _is_reserved(full_path: str) -> bool:
    path = full_path.strip("/")
    if not path:
        return False
    for prefix in _RESERVED_PREFIXES:
        if path == prefix.rstrip("/") or path.startswith(prefix if prefix.endswith("/") else f"{prefix}/"):
            return True
    return False


def _safe_file(static_dir: Path, relative: str) -> Path | None:
    if not relative or relative.endswith("/"):
        return None
    candidate = (static_dir / relative).resolve()
    try:
        candidate.relative_to(static_dir.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


def _cache_headers(relative: str) -> dict[str, str]:
    if relative.startswith("assets/"):
        return {"Cache-Control": "public, max-age=31536000, immutable"}
    return {"Cache-Control": "no-cache"}


def attach_spa(application: FastAPI, directory: Path | None = None) -> None:
    static_dir = resolve_static_dir(directory)
    if static_dir is None:
        return

    index_file = static_dir / "index.html"

    @application.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa_index() -> FileResponse:
        return FileResponse(index_file, media_type="text/html", headers=_cache_headers("index.html"))

    @application.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa_fallback(request: Request, full_path: str) -> Response:
        if _is_reserved(full_path):
            raise HTTPException(status_code=404, detail="Not Found")
        existing = _safe_file(static_dir, full_path)
        if existing is not None:
            headers = _cache_headers(full_path)
            if request.method == "HEAD":
                return Response(status_code=200, headers=headers)
            return FileResponse(existing, headers=headers)
        if Path(full_path).suffix:
            raise HTTPException(status_code=404, detail="Not Found")
        if request.method == "HEAD":
            return Response(status_code=200, media_type="text/html", headers=_cache_headers("index.html"))
        return FileResponse(index_file, media_type="text/html", headers=_cache_headers("index.html"))
