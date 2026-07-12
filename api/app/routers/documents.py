from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.chunking import chunk_text
from app.db import get_connection
from app.parsers.image import parse_image
from app.parsers.markdown import parse_markdown
from app.parsers.pdf import parse_pdf
from app.parsers.pptx import parse_pptx
from app.user_providers import load_providers

router = APIRouter(prefix="/documents", tags=["documents"])

_EXTENSION_TO_TYPE = {
    "pdf": "pdf",
    "md": "md",
    "markdown": "md",
    "pptx": "pptx",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "webp": "image",
    "gif": "image",
}


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    status: str
    page_count: int | None
    error_message: str | None
    created_at: str


@router.get("", response_model=list[DocumentOut])
async def list_documents(user_id: str = Depends(get_current_user_id)):
    async with get_connection() as conn:
        rows = await conn.fetch(
            "select id, filename, file_type, status, page_count, error_message, created_at "
            "from documents where user_id = $1 order by created_at desc",
            user_id,
        )
    return [
        DocumentOut(
            id=str(r["id"]),
            filename=r["filename"],
            file_type=r["file_type"],
            status=r["status"],
            page_count=r["page_count"],
            error_message=r["error_message"],
            created_at=r["created_at"].isoformat(),
        )
        for r in rows
    ]


@router.delete("/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_current_user_id)):
    async with get_connection() as conn:
        result = await conn.execute(
            "delete from documents where id = $1 and user_id = $2", document_id, user_id
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}


@router.post("", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)
):
    extension = (file.filename or "").rsplit(".", 1)[-1].lower()
    file_type = _EXTENSION_TO_TYPE.get(extension)
    if file_type is None:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{extension}")

    file_bytes = await file.read()
    chat_provider, embedding_provider = await load_providers(user_id)

    async with get_connection() as conn:
        doc_row = await conn.fetchrow(
            """
            insert into documents (user_id, filename, file_type, status, embedding_provider, embedding_model)
            values ($1, $2, $3, 'processing', $4, $5)
            returning id, filename, file_type, status, page_count, error_message, created_at
            """,
            user_id,
            file.filename,
            file_type,
            embedding_provider.name,
            embedding_provider.embedding_model,
        )
    document_id = str(doc_row["id"])

    try:
        sections = await _parse(file_type, file_bytes, extension, chat_provider)
        all_chunks: list[dict] = []
        for section in sections:
            all_chunks.extend(chunk_text(section["text"], section["metadata"]))

        if not all_chunks:
            await _mark_status(document_id, "failed", error="No extractable text found in this file.")
            raise HTTPException(status_code=422, detail="No extractable text found in this file.")

        embeddings = await embedding_provider.embed([c["content"] for c in all_chunks])

        async with get_connection() as conn:
            async with conn.transaction():
                for i, (chunk, embedding) in enumerate(zip(all_chunks, embeddings)):
                    await conn.execute(
                        """
                        insert into chunks (
                            document_id, user_id, chunk_index, content, embedding,
                            embedding_provider, embedding_model, metadata
                        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        document_id,
                        user_id,
                        i,
                        chunk["content"],
                        embedding,
                        embedding_provider.name,
                        embedding_provider.embedding_model,
                        chunk["metadata"],
                    )
                await conn.execute(
                    "update documents set status = 'ready', page_count = $2 where id = $1",
                    document_id,
                    len(sections),
                )

    except HTTPException as exc:
        await _mark_status(document_id, "failed", error=exc.detail)
        raise
    except Exception as exc:
        await _mark_status(document_id, "failed", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    async with get_connection() as conn:
        final = await conn.fetchrow(
            "select id, filename, file_type, status, page_count, error_message, created_at "
            "from documents where id = $1",
            document_id,
        )
    return DocumentOut(
        id=str(final["id"]),
        filename=final["filename"],
        file_type=final["file_type"],
        status=final["status"],
        page_count=final["page_count"],
        error_message=final["error_message"],
        created_at=final["created_at"].isoformat(),
    )


async def _parse(file_type: str, file_bytes: bytes, extension: str, chat_provider) -> list[dict]:
    if file_type == "pdf":
        return parse_pdf(file_bytes)
    if file_type == "md":
        return parse_markdown(file_bytes)
    if file_type == "pptx":
        return parse_pptx(file_bytes)
    if file_type == "image":
        return await parse_image(file_bytes, extension, chat_provider)
    raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")


async def _mark_status(document_id: str, status: str, error: str | None = None) -> None:
    async with get_connection() as conn:
        await conn.execute(
            "update documents set status = $2, error_message = $3 where id = $1",
            document_id,
            status,
            str(error) if error else None,
        )
