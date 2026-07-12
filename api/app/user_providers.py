from fastapi import HTTPException

from app.crypto import decrypt
from app.db import get_connection
from app.providers import get_provider
from app.providers.base import Provider


async def load_providers(user_id: str) -> tuple[Provider, Provider]:
    """Return (chat_provider, embedding_provider) configured for this user, decrypting their stored keys."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "select * from user_settings where user_id = $1", user_id
        )

    if row is None or not row["chat_api_key_encrypted"] or not row["embedding_api_key_encrypted"]:
        raise HTTPException(
            status_code=400,
            detail="No API keys configured yet. Add them in Settings before uploading or querying.",
        )

    chat_provider = get_provider(
        row["chat_provider"], decrypt(row["chat_api_key_encrypted"]), chat_model=row["chat_model"]
    )
    embedding_provider = get_provider(
        row["embedding_provider"], decrypt(row["embedding_api_key_encrypted"]), embedding_model=row["embedding_model"]
    )
    return chat_provider, embedding_provider
