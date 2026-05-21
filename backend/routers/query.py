"""Natural-language query routes for SmartPipeline."""

import json
import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models.db_models import Job, QueryHistory
from models.schemas import QueryRequest, QueryResponse
from services.file_cache import file_cache
from services.nl_query_engine import NLQueryEngine


router = APIRouter()
settings = get_settings()


def get_query_engine() -> NLQueryEngine | None:
    """Create the NL query engine when Gemini credentials are available."""

    if not settings.google_api_key:
        return None
    return NLQueryEngine(settings.google_api_key)


async def get_job(job_id: str, session: AsyncSession) -> Job:
    """Fetch a completed job or raise a suitable HTTP error."""

    try:
        parsed_job_id = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job_id.") from exc

    job = await session.get(Job, parsed_job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    if job.status != "SUCCESS" or not job.result_json:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Queries are only available for successfully processed jobs.",
        )
    return job


def build_fallback_expression(question: str, column_schema: list[dict]) -> dict[str, str]:
    """Return a safe default expression when Gemini is unavailable."""

    return {
        "expression": "df.index.notna()",
        "explanation": "Query not applicable - returning all rows",
    }


@router.post("/query", response_model=QueryResponse)
async def query_dataset(
    request: QueryRequest,
    session: AsyncSession = Depends(get_db),
) -> QueryResponse:
    """Answer a natural-language question against a processed dataset."""

    job = await get_job(request.job_id, session)

    try:
        result_payload = json.loads(job.result_json or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored job result could not be decoded.",
        ) from exc

    file_path = settings.upload_dir / f"{request.job_id}_{Path(job.filename).name}"
    try:
        df = file_cache.load_if_needed(request.job_id, str(file_path))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load the underlying dataset for querying.",
        ) from exc

    column_schema = [
        {
            "name": column.get("name"),
            "dtype": column.get("dtype"),
            "ai_inferred_type": column.get("ai_inferred_type", "unknown"),
        }
        for column in list(result_payload.get("column_analyses", []))
    ]

    query_engine = get_query_engine()
    try:
        expression_payload = (
            query_engine.generate_pandas_expression(request.question, column_schema)
            if query_engine is not None
            else build_fallback_expression(request.question, column_schema)
        )
    except Exception:
        expression_payload = build_fallback_expression(request.question, column_schema)

    expression = expression_payload["expression"]
    explanation = expression_payload["explanation"]
    if len(expression) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query expression too long")

    if query_engine is None:
        result_df = df.head(1000)
    else:
        result_df = query_engine.execute_safe(df, expression)

    preview_df = result_df.head(100).copy()
    preview_df = preview_df.where(pd.notna(preview_df), None)

    query_history = QueryHistory(
        job_id=job.id,
        question=request.question,
        pandas_expression=expression,
        row_count=int(len(result_df)),
    )
    session.add(query_history)
    await session.commit()

    return QueryResponse(
        question=request.question,
        pandas_expression=expression,
        row_count=int(len(result_df)),
        columns=[str(column) for column in result_df.columns],
        data=preview_df.to_dict(orient="records"),
        explanation=explanation,
    )
