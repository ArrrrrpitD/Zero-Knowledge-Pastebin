from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Set DEV_MODE=true in .env to use SQLite + fakeredis (no Postgres/Redis needed)
    DEV_MODE: bool = False
    DATABASE_URL: str = "postgresql+asyncpg://zeropaste:zeropaste@localhost:5432/zeropaste"
    REDIS_URL: str = "redis://localhost:6379/0"
    # CORS origins (comma-separated if multiple)
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
