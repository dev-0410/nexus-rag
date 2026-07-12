# Nexus RAG

Multi-tenant, bring-your-own-API-key RAG platform. Upload PDFs, Markdown, PPTX, or images; ask questions answered via hybrid (pgvector + full-text) retrieval over your own documents.

- **Frontend**: React + Vite + Tailwind + shadcn/ui
- **Backend**: FastAPI (deployed as Vercel Python serverless functions)
- **Database**: Supabase Postgres + pgvector
- **Auth**: Supabase Auth (email/password + magic link)

## 1. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migration.sql` from this repo — it enables `pgvector`, creates all tables, RLS policies, and the `hybrid_search` RPC function.
3. Collect these values from **Project Settings**:
   - **API → Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **API → anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **API → service_role key** (keep secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **API → JWT Secret** → `SUPABASE_JWT_SECRET`
   - **Database → Connection string → Session pooler URI** → `DATABASE_URL`

## 2. Configure environment variables

```bash
cp frontend/.env.example frontend/.env
cp api/.env.example api/.env
```

Fill in the values collected above. Generate `ENCRYPTION_KEY` with:

```bash
python3 -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

## 3. Run locally

**Backend:**
```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to `localhost:8000` (see `vite.config.ts`).

## 4. Try it out

1. Open the frontend, sign up with an email/password (or magic link).
2. Go to **Settings**, choose a provider, paste your own OpenAI (or Anthropic) API key, and save — this validates the key live.
   - If you pick **Anthropic** for chat, you'll also need an **OpenAI** key for embeddings (Anthropic has no embeddings API).
3. Go to **Library**, upload a PDF/MD/PPTX/image.
4. Go to **Chat** and ask a question — answers are grounded in your uploaded documents with citations.

## 5. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel
```

Set the same environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project dashboard, then redeploy.

### Free-tier limitations to know about

- **Ingestion runs synchronously** inside a single serverless function call, capped at **10 seconds** on Vercel's Hobby plan. To stay within that:
  - PDFs are capped at 20 pages, PPTX at 30 slides, images at 5MB, Markdown at 200KB (see `api/app/config.py`).
  - Large or scanned/image-heavy files may still time out — if so, split the file or upload a smaller version.
- **Embeddings are pluggable per user** but stored in a single `vector(1536)` column (OpenAI `text-embedding-3-small`). pgvector's HNSW index caps at 2000 dimensions, so 1536-dim models are used rather than the 3072-dim `text-embedding-3-large`. A document is only ever retrieved using a query embedded by the *same* provider/model it was ingested with (tracked automatically) — switching your embedding model does not retroactively re-embed older documents.
