from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import settings
from database import create_tables
from redis_client import close_redis
from rate_limit import limiter
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

# Attach limiter to app state so slowapi can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Security Headers Middleware (Fix #2: XSS/key exfiltration defense) ---
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds strict Content-Security-Policy and other security headers.
    CSP is the primary defense against XSS-based key theft in a ZK app.
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Strict CSP: only allow scripts/styles from self, block inline scripts
        # This prevents an attacker from injecting a <script> that exfiltrates
        # the decryption key from the URL fragment
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' blob: data:; "
            "connect-src 'self' ws://localhost:* wss://localhost:*; "
            "frame-ancestors 'none'; "
            "form-action 'self'; "
            "base-uri 'self';"
        )

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # No referrer leakage (protects URL fragments in edge cases)
        response.headers["Referrer-Policy"] = "no-referrer"

        # Opt out of browser features that could leak data
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        return response


app.add_middleware(SecurityHeadersMiddleware)


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
