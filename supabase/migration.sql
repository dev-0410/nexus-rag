-- Agentic RAG platform schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────
-- user_settings: per-user provider config + encrypted API keys
-- ─────────────────────────────────────────────────────────────
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_provider text not null default 'openai' check (chat_provider in ('openai', 'anthropic', 'gemini')),
  chat_model text,
  chat_api_key_encrypted text,
  embedding_provider text not null default 'openai' check (embedding_provider in ('openai', 'gemini')),
  embedding_model text,
  embedding_api_key_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "users manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- documents: one row per uploaded file
-- ─────────────────────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'md', 'pptx', 'image')),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  embedding_provider text,
  embedding_model text,
  page_count int,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on documents(user_id);

alter table documents enable row level security;

create policy "users manage their own documents"
  on documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- chunks: embedded + searchable text units belonging to a document
-- ─────────────────────────────────────────────────────────────
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  embedding_provider text not null,
  embedding_model text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_user_id_idx on chunks(user_id);
create index if not exists chunks_document_id_idx on chunks(document_id);
create index if not exists chunks_tsv_idx on chunks using gin(tsv);

-- HNSW index for cosine-distance similarity search.
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

alter table chunks enable row level security;

create policy "users manage their own chunks"
  on chunks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Hybrid retrieval RPC: dense (pgvector) + sparse (FTS) with
-- Reciprocal Rank Fusion, scoped to the calling user + optional
-- embedding-provider filter (a query embedding is only comparable
-- to chunks embedded by the same provider/model).
-- ─────────────────────────────────────────────────────────────
create or replace function hybrid_search(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_query_text text,
  p_embedding_provider text,
  p_embedding_model text,
  p_match_count int default 8,
  p_rrf_k int default 60
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  score float
)
language sql stable
as $$
  with dense as (
    select id, row_number() over (order by embedding <=> p_query_embedding) as rnk
    from chunks
    where user_id = p_user_id
      and embedding_provider = p_embedding_provider
      and embedding_model = p_embedding_model
    order by embedding <=> p_query_embedding
    limit 50
  ),
  sparse as (
    select id, row_number() over (order by ts_rank(tsv, websearch_to_tsquery('english', p_query_text)) desc) as rnk
    from chunks
    where user_id = p_user_id
      and embedding_provider = p_embedding_provider
      and embedding_model = p_embedding_model
      and tsv @@ websearch_to_tsquery('english', p_query_text)
    order by ts_rank(tsv, websearch_to_tsquery('english', p_query_text)) desc
    limit 50
  ),
  fused as (
    select id, sum(1.0 / (p_rrf_k + rnk)) as rrf_score
    from (
      select id, rnk from dense
      union all
      select id, rnk from sparse
    ) combined
    group by id
  )
  select c.id, c.document_id, c.content, c.metadata, f.rrf_score
  from fused f
  join chunks c on c.id = f.id
  order by f.rrf_score desc
  limit p_match_count;
$$;
