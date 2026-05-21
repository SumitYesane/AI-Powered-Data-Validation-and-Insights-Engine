"""Job status and result routes for SmartPipeline."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import PlainTextResponse

from database import get_db
from models.db_models import Job, QueryHistory
from models.schemas import JobResult, JobStatus, QueryHistoryItem
from services.job_runtime import job_runtime_store
from services.validation_suggester import suggest_pydantic_model


router = APIRouter(prefix="/jobs")


async def get_job_or_404(job_id: str, session: AsyncSession) -> Job:
    """Load a job by identifier or raise an HTTP 404 error."""

    try:
        parsed_job_id = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job_id.") from exc

    job = await session.get(Job, parsed_job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return job


def read_job_progress(job_id: str, status_value: str) -> int:
    """Read job progress from local runtime state and fall back to status-derived defaults."""

    stored_progress = job_runtime_store.get_progress(job_id)
    if stored_progress is not None:
        return max(0, min(100, int(stored_progress)))
    if status_value == "SUCCESS" or status_value == "FAILURE":
        return 100
    if status_value == "STARTED":
        return 25
    return 0


def resolve_status_message(job: Job) -> str:
    """Derive a human-readable message for a job."""

    runtime_message = job_runtime_store.get_message(str(job.id))
    if runtime_message and job.status in {"PENDING", "STARTED"}:
        return runtime_message
    if job.status == "SUCCESS":
        return "Processing completed successfully."
    if job.status == "STARTED":
        return "File is currently being processed."
    if job.status == "FAILURE":
        if job.result_json:
            try:
                payload = json.loads(job.result_json)
                return str(payload.get("error", "Processing failed."))
            except json.JSONDecodeError:
                return "Processing failed."
        return "Processing failed."
    return "Job is queued for processing."


@router.get("/{job_id}/status", response_model=JobStatus)
async def get_job_status(job_id: str, session: AsyncSession = Depends(get_db)) -> JobStatus:
    """Return the current lifecycle status of a processing job."""

    job = await get_job_or_404(job_id, session)
    progress = read_job_progress(job_id, job.status)
    message = resolve_status_message(job)
    status_value = job.status if job.status in {"PENDING", "STARTED", "SUCCESS", "FAILURE"} else "PENDING"

    return JobStatus(job_id=job_id, status=status_value, progress=progress, message=message)


@router.get("/{job_id}/result", response_model=JobResult)
async def get_job_result(job_id: str, session: AsyncSession = Depends(get_db)) -> JobResult:
    """Return the final analysis payload for a job when available."""

    job = await get_job_or_404(job_id, session)
    if job.status != "SUCCESS" or not job.result_json:
        raise HTTPException(status_code=status.HTTP_202_ACCEPTED, detail="Job result is not available yet.")

    try:
        payload = json.loads(job.result_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored job result could not be decoded.",
        ) from exc

    return JobResult(**payload)


@router.get("/{job_id}/suggested-model", response_class=PlainTextResponse)
async def get_suggested_model(job_id: str, session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    """Return a generated Pydantic model for the processed dataset."""

    job = await get_job_or_404(job_id, session)
    if job.status != "SUCCESS" or not job.result_json:
        raise HTTPException(status_code=status.HTTP_202_ACCEPTED, detail="Job result is not available yet.")

    try:
        payload = json.loads(job.result_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored job result could not be decoded.",
        ) from exc

    model_code = suggest_pydantic_model(job_id, list(payload.get("column_analyses", [])))
    return PlainTextResponse(content=model_code)


@router.get("/{job_id}/query-history", response_model=list[QueryHistoryItem])
async def get_query_history(job_id: str, session: AsyncSession = Depends(get_db)) -> list[QueryHistoryItem]:
    """Return the last 20 natural-language queries for a job."""

    job = await get_job_or_404(job_id, session)
    query = (
        select(QueryHistory)
        .where(QueryHistory.job_id == job.id)
        .order_by(QueryHistory.created_at.desc())
        .limit(20)
    )
    result = await session.execute(query)
    items = result.scalars().all()
    return [
        QueryHistoryItem(
            question=item.question,
            pandas_expression=item.pandas_expression,
            row_count=item.row_count,
            created_at=item.created_at.isoformat(),
        )
        for item in items
    ]
