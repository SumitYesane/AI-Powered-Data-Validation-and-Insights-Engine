"""Upload routes for SmartPipeline."""

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models.db_models import Job
from models.schemas import UploadResponse
from services.processing_service import process_file_local


router = APIRouter()
settings = get_settings()
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
CHUNK_SIZE = 1024 * 1024


def build_storage_path(job_id: str, filename: str) -> Path:
    """Return the on-disk destination path for an uploaded file."""

    safe_name = Path(filename).name
    return settings.upload_dir / f"{job_id}_{safe_name}"


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """Accept a CSV or Excel file, create a job, and launch local background processing."""

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required.")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only CSV and Excel files are allowed.",
        )

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    job_id = str(uuid.uuid4())
    storage_path = build_storage_path(job_id, file.filename)

    total_size = 0
    with storage_path.open("wb") as output_file:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.max_upload_size_bytes:
                output_file.close()
                storage_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Uploaded file exceeds the maximum allowed size.",
                )
            output_file.write(chunk)

    job = Job(
        id=uuid.UUID(job_id),
        filename=Path(file.filename).name,
        file_size_bytes=total_size,
        status="PENDING",
    )
    session.add(job)
    await session.commit()

    background_tasks.add_task(
        process_file_local,
        job_id,
        str(storage_path),
        job.filename,
        settings.google_api_key,
    )

    return UploadResponse(
        job_id=job_id,
        filename=job.filename,
        file_size_bytes=total_size,
        status="PENDING",
    )
