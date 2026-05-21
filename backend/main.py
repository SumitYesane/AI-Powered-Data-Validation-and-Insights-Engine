"""FastAPI application entrypoint for SmartPipeline."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import api_router


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize shared resources during startup."""

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=settings.debug,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/")
async def root() -> dict[str, str]:
    """Return a simple service metadata response."""

    return {"service": settings.app_name, "status": "running"}
