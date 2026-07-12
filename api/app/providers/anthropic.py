import base64

import httpx

from app.providers.base import Provider

_BASE_URL = "https://api.anthropic.com/v1"
_ANTHROPIC_VERSION = "2023-06-01"


class AnthropicProvider(Provider):
    name = "anthropic"
    chat_model = "claude-sonnet-4-5"
    embedding_model = ""  # Anthropic has no embeddings API; embeddings always come from a separate provider.
    embedding_dim = 0
    supports_vision = True

    def _headers(self) -> dict:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError(
            "Anthropic has no embeddings API; configure a separate embedding provider."
        )

    async def chat(self, system: str, messages: list[dict]) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE_URL}/messages",
                headers=self._headers(),
                json={
                    "model": self.chat_model,
                    "system": system,
                    "messages": messages,
                    "max_tokens": 2048,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return "".join(block["text"] for block in data["content"] if block["type"] == "text")

    async def describe_image(self, image_bytes: bytes, mime_type: str) -> str:
        b64 = base64.b64encode(image_bytes).decode()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/messages",
                headers=self._headers(),
                json={
                    "model": self.chat_model,
                    "max_tokens": 1024,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {"type": "base64", "media_type": mime_type, "data": b64},
                                },
                                {
                                    "type": "text",
                                    "text": "Transcribe all visible text and describe this image in detail, "
                                    "for use as searchable document content.",
                                },
                            ],
                        }
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return "".join(block["text"] for block in data["content"] if block["type"] == "text")

    async def test_connection(self) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_BASE_URL}/messages",
                headers=self._headers(),
                json={
                    "model": self.chat_model,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "ping"}],
                },
            )
            resp.raise_for_status()
