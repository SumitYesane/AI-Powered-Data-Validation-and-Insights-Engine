"""Database engine and session utilities for SmartPipeline."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
    """Base declarative model for SQLAlchemy ORM tables."""


engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for request handlers."""

    async with AsyncSessionLocal() as session:
        yield session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session using the canonical FastAPI dependency name."""

    async with AsyncSessionLocal() as session:
        yield session
