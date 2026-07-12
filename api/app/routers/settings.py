import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.config import settings
from app.crypto import decrypt, encrypt, mask
from app.db import get_connection
from app.providers import EMBEDDING_CAPABLE_PROVIDERS, SUPPORTED_PROVIDERS, get_provider

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsIn(BaseModel):
    chat_provider: str
    chat_api_key: str
    chat_model: str | None = None
    embedding_provider: str
    embedding_api_key: str
    embedding_model: str | None = None


class SettingsOut(BaseModel):
    chat_provider: str
    chat_model: str | None
    chat_api_key_masked: str | None
    embedding_provider: str
    embedding_model: str | None
    embedding_api_key_masked: str | None


@router.get("", response_model=SettingsOut | None)
async def get_settings(user_id: str = Depends(get_current_user_id)):
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "select * from user_settings where user_id = $1", user_id
        )
    if row is None:
        return None
    return SettingsOut(
        chat_provider=row["chat_provider"],
        chat_model=row["chat_model"],
        chat_api_key_masked=mask(decrypt(row["chat_api_key_encrypted"])) if row["chat_api_key_encrypted"] else None,
        embedding_provider=row["embedding_provider"],
        embedding_model=row["embedding_model"],
        embedding_api_key_masked=mask(decrypt(row["embedding_api_key_encrypted"])) if row["embedding_api_key_encrypted"] else None,
    )


@router.put("", response_model=SettingsOut)
async def put_settings(body: SettingsIn, user_id: str = Depends(get_current_user_id)):
    if body.chat_provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported chat provider: {body.chat_provider}")
    if body.embedding_provider not in EMBEDDING_CAPABLE_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported embedding provider: {body.embedding_provider}")

    chat_provider = get_provider(body.chat_provider, body.chat_api_key, chat_model=body.chat_model)
    await _test_or_400(chat_provider)

    embedding_provider = get_provider(body.embedding_provider, body.embedding_api_key, embedding_model=body.embedding_model)
    await _test_or_400(embedding_provider)
    await _validate_embedding_dim(embedding_provider)

    chat_key_enc = encrypt(body.chat_api_key)
    embedding_key_enc = encrypt(body.embedding_api_key)

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                insert into user_settings (
                    user_id, chat_provider, chat_model, chat_api_key_encrypted,
                    embedding_provider, embedding_model, embedding_api_key_encrypted, updated_at
                ) values ($1, $2, $3, $4, $5, $6, $7, now())
                on conflict (user_id) do update set
                    chat_provider = excluded.chat_provider,
                    chat_model = excluded.chat_model,
                    chat_api_key_encrypted = excluded.chat_api_key_encrypted,
                    embedding_provider = excluded.embedding_provider,
                    embedding_model = excluded.embedding_model,
                    embedding_api_key_encrypted = excluded.embedding_api_key_encrypted,
                    updated_at = now()
                returning *
                """,
                user_id,
                body.chat_provider,
                body.chat_model or chat_provider.chat_model,
                chat_key_enc,
                body.embedding_provider,
                body.embedding_model or embedding_provider.embedding_model,
                embedding_key_enc,
            )
    except asyncpg.exceptions.CheckViolationError:
        raise HTTPException(
            status_code=400,
            detail=(
                f"The database does not yet allow provider '{body.chat_provider}'. "
                "Run supabase/add_gemini.sql in the Supabase SQL editor to enable it."
            ),
        )

    return SettingsOut(
        chat_provider=row["chat_provider"],
        chat_model=row["chat_model"],
        chat_api_key_masked=mask(body.chat_api_key),
        embedding_provider=row["embedding_provider"],
        embedding_model=row["embedding_model"],
        embedding_api_key_masked=mask(body.embedding_api_key),
    )


async def _test_or_400(provider) -> None:
    try:
        await provider.test_connection()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not verify {provider.name} API key: {exc}")


async def _validate_embedding_dim(provider) -> None:
    """Ensure the chosen embedding model produces vectors that fit the DB column."""
    try:
        [vec] = await provider.embed(["dimension check"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Embedding test call failed: {exc}")
    if len(vec) != settings.embedding_dim:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Embedding model '{provider.embedding_model}' returns {len(vec)} dimensions, "
                f"but this deployment stores {settings.embedding_dim}-dim vectors. "
                f"Use a {settings.embedding_dim}-dim model such as text-embedding-3-small."
            ),
        )
