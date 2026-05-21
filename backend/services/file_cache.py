"""In-memory dataframe cache for SmartPipeline query workloads."""

from __future__ import annotations

from threading import Lock

import pandas as pd

from services.data_processor import DataProcessor


class FileCache:
    """Cache loaded dataframes by job identifier to avoid repeated disk reads."""

    def __init__(self) -> None:
        """Initialize the cache storage and loader dependencies."""

        self._cache: dict[str, pd.DataFrame] = {}
        self._lock = Lock()
        self._processor = DataProcessor()

    def load_if_needed(self, job_id: str, file_path: str) -> pd.DataFrame:
        """Return a cached dataframe or load and cache it on first access."""

        with self._lock:
            if job_id not in self._cache:
                self._cache[job_id] = self._processor.load_file(file_path, file_path)
            return self._cache[job_id]


file_cache = FileCache()
