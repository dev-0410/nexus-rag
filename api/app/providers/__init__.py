from app.providers.anthropic import AnthropicProvider
from app.providers.base import Provider
from app.providers.gemini import GeminiProvider
from app.providers.openai import OpenAIProvider

_REGISTRY: dict[str, type[Provider]] = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}

SUPPORTED_PROVIDERS = list(_REGISTRY.keys())
# Providers that expose an embeddings API (Anthropic does not).
EMBEDDING_CAPABLE_PROVIDERS = ["openai", "gemini"]


def get_provider(name: str, api_key: str, embedding_model: str | None = None, chat_model: str | None = None) -> Provider:
    provider_cls = _REGISTRY.get(name)
    if provider_cls is None:
        raise ValueError(f"Unsupported provider: {name}")
    return provider_cls(api_key, embedding_model=embedding_model, chat_model=chat_model)
