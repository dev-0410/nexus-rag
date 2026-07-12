import base64

import httpx

from app.providers.base import Provider

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(Provider):
    name = "gemini"
    embedding_model = "gemini-embedding-001"
    # "…-latest" alias — routes to the current free flash model. Pinned IDs like
    # gemini-2.5-flash are being retired for new API keys and 404 on generateContent.
    chat_model = "gemini-flash-latest"
    embedding_dim = 1536
    supports_vision = True

    def _headers(self) -> dict:
        return {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

    @staticmethod
    def _to_gemini_contents(messages: list[dict]) -> list[dict]:
        # Our history uses roles "user"/"assistant"; Gemini expects "user"/"model".
        contents = []
        for m in messages:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        return contents

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=30) as client:
            # Gemini's embedContent handles one input per call; batch sequentially.
            for text in texts:
                resp = await client.post(
                    f"{_BASE_URL}/models/{self.embedding_model}:embedContent",
                    headers=self._headers(),
                    json={
                        "model": f"models/{self.embedding_model}",
                        "content": {"parts": [{"text": text}]},
                        "outputDimensionality": self.embedding_dim,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                vectors.append(data["embedding"]["values"])
        return vectors

    async def chat(self, system: str, messages: list[dict]) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_BASE_URL}/models/{self.chat_model}:generateContent",
                headers=self._headers(),
                json={
                    "system_instruction": {"parts": [{"text": system}]},
                    "contents": self._to_gemini_contents(messages),
                    "generationConfig": {"temperature": 0.2},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return ""
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)

    async def describe_image(self, image_bytes: bytes, mime_type: str) -> str:
        b64 = base64.b64encode(image_bytes).decode()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_BASE_URL}/models/{self.chat_model}:generateContent",
                headers=self._headers(),
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "text": "Transcribe all visible text and describe this image in detail, "
                                    "for use as searchable document content.",
                                },
                                {"inline_data": {"mime_type": mime_type, "data": b64}},
                            ],
                        }
                    ]
                },
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return ""
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)

    async def test_connection(self) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{_BASE_URL}/models", headers=self._headers())
            resp.raise_for_status()
