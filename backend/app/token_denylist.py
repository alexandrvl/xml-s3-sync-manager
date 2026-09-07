from __future__ import annotations

import hashlib
import threading
import time
from typing import Any

_lock = threading.Lock()
_denied: dict[str, int] = {}


def token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_id_from_claims(claims: dict[str, Any], token: str) -> str:
    for key in ("jti", "uti"):
        raw = claims.get(key)
        if raw:
            return str(raw)
    return token_fingerprint(token)


def revoke(token_id: str, exp: int | None) -> None:
    expiry = int(exp) if exp else int(time.time()) + 8 * 3600
    with _lock:
        _prune_locked()
        _denied[token_id] = expiry


def is_revoked(token_id: str) -> bool:
    with _lock:
        _prune_locked()
        return token_id in _denied


def _prune_locked() -> None:
    now = int(time.time())
    expired = [key for key, exp in _denied.items() if exp <= now]
    for key in expired:
        del _denied[key]


def reset_for_tests() -> None:
    with _lock:
        _denied.clear()
