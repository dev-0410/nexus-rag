import base64

import httpx

from app.providers.base import Provider

_BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider(Provider):
    name = "openai"
    embedding_model = "text-embedding-3-small"
    chat_model = "gpt-4o-mini"
    embedding_dim = 1536
    supports_vision = True

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def embed(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/embeddings",
                headers=self._headers(),
                json={"model": self.embedding_model, "input": texts},
            )
            resp.raise_for_status()
            data = resp.json()
            return [item["embedding"] for item in data["data"]]

    async def chat(self, system: str, messages: list[dict]) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.chat_model,
                    "messages": [{"role": "system", "content": system}, *messages],
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def describe_image(self, image_bytes: bytes, mime_type: str) -> str:
        b64 = base64.b64encode(image_bytes).decode()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.chat_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Transcribe all visible text and describe this image in detail, "
                                    "for use as searchable document content.",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                                },
                            ],
                        }
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{_BASE_URL}/models", headers=self._headers())
            resp.raise_for_status()
