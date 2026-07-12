from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Public JWKS endpoint used to verify Supabase-issued auth JWTs (ES256).
    supabase_jwks_url: str
    # Postgres connection string with pgvector enabled (Supabase session pooler).
    database_url: str
    # Base64 32-byte key for AES-GCM encryption of stored provider API keys.
    encryption_key: str

    # Optional — kept for convenience / future server-side Supabase calls.
    supabase_url: str = ""
    supabase_secret_key: str = ""

    max_pdf_pages: int = 20
    max_pptx_slides: int = 30
    max_image_mb: int = 5
    max_markdown_kb: int = 200

    chunk_size_tokens: int = 500
    chunk_overlap_tokens: int = 50
    embedding_dim: int = 1536

    class Config:
        env_file = ".env"


settings = Settings()
