from abc import ABC, abstractmethod


class Provider(ABC):
    name: str
    embedding_model: str
    chat_model: str
    embedding_dim: int
    supports_vision: bool = False

    def __init__(self, api_key: str, embedding_model: str | None = None, chat_model: str | None = None):
        self.api_key = api_key
        if embedding_model:
            self.embedding_model = embedding_model
        if chat_model:
            self.chat_model = chat_model

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text."""

    @abstractmethod
    async def chat(self, system: str, messages: list[dict]) -> str:
        """Return the assistant's text response given a system prompt and message history."""

    @abstractmethod
    async def describe_image(self, image_bytes: bytes, mime_type: str) -> str:
        """Return a text description/transcription of an image, for ingestion."""

    @abstractmethod
    async def test_connection(self) -> None:
        """Raise an exception if the API key is invalid."""
