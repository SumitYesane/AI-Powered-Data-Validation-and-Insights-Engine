"""Create jobs and query_history tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_create_jobs_and_query_history"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the initial SmartPipeline tables."""

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
    )
    op.create_table(
        "query_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("pandas_expression", sa.Text(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_query_history_job_id", "query_history", ["job_id"], unique=False)


def downgrade() -> None:
    """Drop the initial SmartPipeline tables."""

    op.drop_index("ix_query_history_job_id", table_name="query_history")
    op.drop_table("query_history")
    op.drop_table("jobs")
