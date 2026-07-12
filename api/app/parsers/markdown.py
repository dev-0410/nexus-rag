from fastapi import HTTPException

from app.config import settings


def parse_markdown(file_bytes: bytes) -> list[dict]:
    size_kb = len(file_bytes) / 1024
    if size_kb > settings.max_markdown_kb:
        raise HTTPException(
            status_code=413,
            detail=f"Markdown file is {size_kb:.0f}KB; the limit is {settings.max_markdown_kb}KB.",
        )

    text = file_bytes.decode("utf-8", errors="ignore")
    if not text.strip():
        return []
    return [{"text": text, "metadata": {}}]
