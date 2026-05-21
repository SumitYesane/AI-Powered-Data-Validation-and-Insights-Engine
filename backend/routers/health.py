"""Health-check routes for SmartPipeline."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import APIRouter, Depends

from database import get_db_session


router = APIRouter()


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_db_session)) -> dict[str, str]:
    """Return service health including database readiness."""

    await session.execute(text("SELECT 1"))
    return {"status": "ok"}
