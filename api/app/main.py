from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import documents, query, settings

app = FastAPI(title="Agentic RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(query.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
