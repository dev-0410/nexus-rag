import json
from contextlib import asynccontextmanager

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


def _encode_vector(value: list[float]) -> str:
    return "[" + ",".join(str(v) for v in value) + "]"


def _decode_vector(value: str) -> list[float]:
    return json.loads(value)


async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "vector",
        encoder=_encode_vector,
        decoder=_decode_vector,
        schema="public",
        format="text",
    )
    # Let asyncpg accept/return Python dicts for jsonb columns directly.
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # Small pool: on Vercel each warm function instance keeps its own pool,
        # so keep max_size low to avoid exhausting Supabase's connection limit
        # across many concurrent serverless instances. Use the transaction
        # pooler (port 6543) in production. statement_cache_size=0 is required
        # because pgbouncer transaction mode doesn't support prepared statements.
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=2,
            init=_init_connection,
            statement_cache_size=0,
        )
    return _pool


@asynccontextmanager
async def get_connection():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
