from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

# In dev mode use SQLite so no Postgres install is needed
if settings.DEV_MODE:
    _db_url = "sqlite+aiosqlite:///./zeropaste_dev.db"
    _connect_args = {"check_same_thread": False}
else:
    _db_url = settings.DATABASE_URL
    _connect_args = {}

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        from models import Paste  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
