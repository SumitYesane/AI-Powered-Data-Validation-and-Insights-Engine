"""API router aggregation for SmartPipeline."""

from fastapi import APIRouter

from routers.health import router as health_router
from routers.jobs import router as jobs_router
from routers.query import router as query_router
from routers.upload import router as upload_router


api_router = APIRouter(prefix="/api")
api_router.include_router(health_router, tags=["health"])
api_router.include_router(upload_router, tags=["uploads"])
api_router.include_router(jobs_router, tags=["jobs"])
api_router.include_router(query_router, tags=["query"])

__all__ = ["api_router"]
