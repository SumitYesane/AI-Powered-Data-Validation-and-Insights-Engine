"""In-memory runtime state for local SmartPipeline jobs."""

from __future__ import annotations

from threading import Lock


class JobRuntimeStore:
    """Track transient progress and messages for local in-process jobs."""

    def __init__(self) -> None:
        """Initialize the in-memory runtime store."""

        self._lock = Lock()
        self._progress: dict[str, int] = {}
        self._messages: dict[str, str] = {}

    def set(self, job_id: str, progress: int, message: str) -> None:
        """Store progress and a user-facing status message for a job."""

        with self._lock:
            self._progress[job_id] = max(0, min(100, progress))
            self._messages[job_id] = message

    def get_progress(self, job_id: str) -> int | None:
        """Return the current progress value for a job, if present."""

        with self._lock:
            return self._progress.get(job_id)

    def get_message(self, job_id: str) -> str | None:
        """Return the current progress message for a job, if present."""

        with self._lock:
            return self._messages.get(job_id)

    def clear(self, job_id: str) -> None:
        """Remove runtime state for a finished job."""

        with self._lock:
            self._progress.pop(job_id, None)
            self._messages.pop(job_id, None)


job_runtime_store = JobRuntimeStore()
