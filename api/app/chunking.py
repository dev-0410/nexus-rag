import tiktoken

from app.config import settings

_encoding = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str, metadata: dict | None = None) -> list[dict]:
    """Split text into overlapping token-bounded chunks, each tagged with the given metadata."""
    tokens = _encoding.encode(text)
    if not tokens:
        return []

    size = settings.chunk_size_tokens
    overlap = settings.chunk_overlap_tokens
    step = size - overlap

    chunks = []
    for start in range(0, len(tokens), step):
        window = tokens[start : start + size]
        if not window:
            continue
        chunk_str = _encoding.decode(window)
        if chunk_str.strip():
            chunks.append({"content": chunk_str.strip(), "metadata": metadata or {}})
        if start + size >= len(tokens):
            break

    return chunks
