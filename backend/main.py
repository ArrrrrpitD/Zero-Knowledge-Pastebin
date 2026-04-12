from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_tables
from redis_client import close_redis
from routers import pastes, presence


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_tables()
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title="ZeroPaste API",
    description="Zero-knowledge pastebin — the server only sees encrypted blobs.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(pastes.router)
app.include_router(presence.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
