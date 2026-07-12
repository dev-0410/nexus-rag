import time

import httpx
from fastapi import Header, HTTPException
from jose import jwt, JWTError

from app.config import settings

# In-process JWKS cache. Supabase signs auth JWTs with an asymmetric key
# (ES256) whose public half is published at the project's JWKS URL. We fetch
# it once, cache it, and refresh if we encounter a key id we don't recognise
# (e.g. after a key rotation).
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600  # seconds


async def _get_jwks(force: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if not force and _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(settings.supabase_jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = now
    return _jwks_cache


async def _find_key(kid: str) -> dict | None:
    jwks = await _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    # unknown kid — the signing key may have rotated; refetch once
    jwks = await _get_jwks(force=True)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")

    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Malformed token")

    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing key id")

    key = await _find_key(kid)
    if key is None:
        raise HTTPException(status_code=401, detail="Signing key not found")

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[header.get("alg", "ES256")],
            audience="authenticated",
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return user_id
