"""Local in-process file processing service for SmartPipeline."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from time import perf_counter
from typing import Any
from uuid import UUID

from database import AsyncSessionLocal
from models.db_models import Job
from models.schemas import ColumnAnalysis, JobResult
from services.ai_analyzer import AIDataAnalyzer
from services.data_processor import DataProcessor
from services.job_runtime import job_runtime_store


logger = logging.getLogger(__name__)
data_processor = DataProcessor()


def utcnow() -> datetime:
    """Return the current UTC datetime."""

    return datetime.now(timezone.utc)


def build_summary(filename: str, row_count: int, column_analyses: list[ColumnAnalysis]) -> str:
    """Create a concise summary of the profiling results."""

    high_null_columns = [column.name for column in column_analyses if column.null_pct >= 20]
    anomaly_columns = [column.name for column in column_analyses if column.anomalies]

    summary_parts = [
        f"Processed `{filename}` with {row_count} rows and {len(column_analyses)} columns.",
        f"Identified {len(anomaly_columns)} columns with notable anomalies.",
    ]
    if high_null_columns:
        summary_parts.append(f"High missing-value columns: {', '.join(high_null_columns[:5])}.")
    return " ".join(summary_parts)


def create_ai_analyzer(gemini_api_key: str | None) -> AIDataAnalyzer | None:
    """Create the AI analyzer when a Gemini API key is configured."""

    if not gemini_api_key:
        return None
    return AIDataAnalyzer(gemini_api_key)


async def update_job_record(job_id: str, **changes: Any) -> None:
    """Apply partial updates to a job record in Postgres."""

    async with AsyncSessionLocal() as session:
        job = await session.get(Job, UUID(job_id))
        if job is None:
            return
        for field_name, field_value in changes.items():
            setattr(job, field_name, field_value)
        await session.commit()


async def persist_success(job_id: str, payload: JobResult) -> None:
    """Persist a successful job result payload."""

    await update_job_record(
        job_id,
        status="SUCCESS",
        completed_at=utcnow(),
        result_json=payload.model_dump_json(),
    )


async def persist_failure(job_id: str, error_message: str) -> None:
    """Persist a failed job result payload."""

    await update_job_record(
        job_id,
        status="FAILURE",
        completed_at=utcnow(),
        result_json=json.dumps({"error": error_message}),
    )


def build_column_analysis(stats: dict[str, Any], anomalies: list[str]) -> ColumnAnalysis:
    """Create a complete column analysis payload from stats and rule-based anomalies."""

    return ColumnAnalysis(
        name=str(stats["name"]),
        dtype=str(stats["dtype"]),
        null_count=int(stats["null_count"]),
        null_pct=float(stats["null_pct"]),
        unique_count=int(stats["unique_count"]),
        sample_values=list(stats["sample_values"]),
        min_val=stats["min_val"],
        max_val=stats["max_val"],
        ai_inferred_type="pending",
        anomalies=anomalies,
        suggested_validation="pending",
    )


def merge_ai_enrichment(
    filename: str,
    row_count: int,
    base_columns: list[dict[str, Any]],
    gemini_api_key: str | None,
) -> tuple[list[dict[str, Any]], str, bool]:
    """Apply AI enrichment when available and degrade gracefully on failure."""

    analyzer = create_ai_analyzer(gemini_api_key)
    if analyzer is None:
        return base_columns, build_summary(
            filename,
            row_count,
            [ColumnAnalysis(**column) for column in base_columns],
        ), False

    try:
        enriched_columns = analyzer.analyze_columns(base_columns, filename)
        summary = analyzer.generate_summary(filename, row_count, enriched_columns)
        return enriched_columns, summary, True
    except Exception as exc:
        logger.warning("AI analysis failed for %s: %s", filename, exc)
        return base_columns, build_summary(
            filename,
            row_count,
            [ColumnAnalysis(**column) for column in base_columns],
        ), False


async def process_file_local(job_id: str, file_path: str, filename: str, gemini_api_key: str | None) -> dict[str, Any]:
    """Process an uploaded file locally inside the FastAPI process."""

    await update_job_record(job_id, status="STARTED")
    job_runtime_store.set(job_id, 0, "Uploading...")

    started_at = perf_counter()
    try:
        dataframe = data_processor.load_file(file_path, filename)
        job_runtime_store.set(job_id, 25, "Reading file...")

        stats_by_column = data_processor.compute_column_stats(dataframe)
        job_runtime_store.set(job_id, 50, "Computing statistics...")

        column_analyses = [
            build_column_analysis(
                stats,
                data_processor.detect_basic_anomalies(dataframe, str(stats["name"]), stats),
            )
            for stats in stats_by_column
        ]
        job_runtime_store.set(job_id, 75, "Running AI analysis...")

        row_count = int(len(dataframe))
        base_columns = [column_analysis.model_dump() for column_analysis in column_analyses]
        enriched_columns, ai_summary, ai_succeeded = merge_ai_enrichment(
            filename,
            row_count,
            base_columns,
            gemini_api_key,
        )
        if ai_succeeded:
            logger.info("AI analysis complete for job %s: %s columns analyzed", job_id, len(enriched_columns))

        result = JobResult(
            job_id=job_id,
            filename=filename,
            row_count=row_count,
            column_count=int(len(dataframe.columns)),
            column_analyses=[ColumnAnalysis(**column) for column in enriched_columns],
            ai_summary=ai_summary,
            processing_time_seconds=round(perf_counter() - started_at, 3),
        )

        await persist_success(job_id, result)
        job_runtime_store.set(job_id, 100, "Complete!")
        return result.model_dump()
    except Exception as exc:
        error_message = str(exc)
        await persist_failure(job_id, error_message)
        job_runtime_store.set(job_id, 100, error_message)
        raise
