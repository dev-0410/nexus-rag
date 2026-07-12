from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.db import get_connection
from app.user_providers import load_providers

router = APIRouter(prefix="/query", tags=["query"])


class QueryIn(BaseModel):
    question: str
    history: list[dict] = []


class Citation(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    snippet: str
    score: float


class QueryOut(BaseModel):
    answer: str
    citations: list[Citation]


_SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions using only the provided context excerpts. "
    "Cite sources inline using [1], [2], etc. matching the excerpt numbers given. "
    "If the context does not contain the answer, say so plainly rather than guessing."
)


@router.post("", response_model=QueryOut)
async def query(body: QueryIn, user_id: str = Depends(get_current_user_id)):
    chat_provider, embedding_provider = await load_providers(user_id)

    [query_embedding] = await embedding_provider.embed([body.question])

    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            select r.chunk_id, r.document_id, r.content, r.metadata, r.score, d.filename
            from hybrid_search($1, $2, $3, $4, $5, 8, 60) r
            join documents d on d.id = r.document_id
            """,
            user_id,
            query_embedding,
            body.question,
            embedding_provider.name,
            embedding_provider.embedding_model,
        )

    if not rows:
        return QueryOut(
            answer="I couldn't find any relevant content in your uploaded documents to answer that.",
            citations=[],
        )

    context_block = "\n\n".join(
        f"[{i+1}] (from {r['filename']}):\n{r['content']}" for i, r in enumerate(rows)
    )
    user_message = f"Context excerpts:\n\n{context_block}\n\nQuestion: {body.question}"

    messages = [*body.history, {"role": "user", "content": user_message}]
    answer = await chat_provider.chat(_SYSTEM_PROMPT, messages)

    citations = [
        Citation(
            chunk_id=str(r["chunk_id"]),
            document_id=str(r["document_id"]),
            filename=r["filename"],
            snippet=r["content"][:280],
            score=float(r["score"]),
        )
        for r in rows
    ]

    return QueryOut(answer=answer, citations=citations)
