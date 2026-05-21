"""Pydantic request and response schemas for SmartPipeline."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ColumnAnalysis(BaseModel):
    """Column-level profiling and validation suggestions."""

    name: str
    dtype: str
    null_count: int
    null_pct: float
    unique_count: int
    sample_values: list
    min_val: str | None
    max_val: str | None
    ai_inferred_type: str
    anomalies: list[str]
    suggested_validation: str


class UploadResponse(BaseModel):
    """Response returned after a file upload is accepted."""

    job_id: str
    filename: str
    file_size_bytes: int
    status: str


class JobStatus(BaseModel):
    """Current processing state for an uploaded job."""

    job_id: str
    status: Literal["PENDING", "STARTED", "SUCCESS", "FAILURE"]
    progress: int = Field(ge=0, le=100)
    message: str


class JobResult(BaseModel):
    """Final analysis payload generated for a processed upload."""

    job_id: str
    filename: str
    row_count: int
    column_count: int
    column_analyses: list[ColumnAnalysis]
    ai_summary: str
    processing_time_seconds: float


class QueryRequest(BaseModel):
    """Natural-language question targeting a processed dataset."""

    job_id: str
    question: str = Field(min_length=1, max_length=2_000)


class QueryResponse(BaseModel):
    """Structured result for a natural-language data query."""

    question: str
    pandas_expression: str
    row_count: int
    columns: list[str]
    data: list[dict]
    explanation: str

    model_config = ConfigDict(arbitrary_types_allowed=False)


class QueryHistoryItem(BaseModel):
    """Query history entry for a processed job."""

    question: str
    pandas_expression: str
    row_count: int
    created_at: str
