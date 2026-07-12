from fastapi import HTTPException

from app.config import settings
from app.providers.base import Provider

_MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


async def parse_image(file_bytes: bytes, extension: str, provider: Provider) -> list[dict]:
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > settings.max_image_mb:
        raise HTTPException(
            status_code=413,
            detail=f"Image is {size_mb:.1f}MB; the limit is {settings.max_image_mb}MB.",
        )

    if not provider.supports_vision:
        raise HTTPException(
            status_code=400,
            detail=f"The '{provider.name}' provider does not support image ingestion.",
        )

    mime_type = _MIME_MAP.get(extension.lower())
    if mime_type is None:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {extension}")

    description = await provider.describe_image(file_bytes, mime_type)
    if not description.strip():
        return []
    return [{"text": description, "metadata": {}}]
