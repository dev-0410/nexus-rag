from io import BytesIO

from fastapi import HTTPException
from pypdf import PdfReader

from app.config import settings


def parse_pdf(file_bytes: bytes) -> list[dict]:
    reader = PdfReader(BytesIO(file_bytes))
    if len(reader.pages) > settings.max_pdf_pages:
        raise HTTPException(
            status_code=413,
            detail=f"PDF has {len(reader.pages)} pages; the limit is {settings.max_pdf_pages}.",
        )

    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"text": text, "metadata": {"page": i + 1}})
    return pages
