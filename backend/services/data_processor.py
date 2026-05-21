"""Pandas data processing utilities for SmartPipeline."""

from __future__ import annotations

from pathlib import Path
from random import Random
from typing import Any
import warnings

import pandas as pd


class DataProcessor:
    """Load uploaded datasets and compute deterministic profiling statistics."""

    CSV_ENCODINGS = ("utf-8", "utf-8-sig", "cp1252", "latin-1")
    CSV_SEP_CANDIDATES = (",", ";", "\t", "|")

    def __init__(self, chunk_size: int = 5000, large_file_threshold: int = 50000) -> None:
        """Initialize the processor with chunking thresholds."""

        self.chunk_size = chunk_size
        self.large_file_threshold = large_file_threshold
        self._sampler = Random(42)

    def load_file(self, file_path: str, filename: str) -> pd.DataFrame:
        """Load a CSV or Excel file and infer column types after reading."""

        path = Path(file_path)
        suffix = path.suffix.lower() or Path(filename).suffix.lower()
        if suffix == ".csv":
            dataframe = self._load_csv(path)
        elif suffix in {".xlsx", ".xls"}:
            dataframe = self._load_excel(path)
        else:
            raise ValueError("Unsupported file type. Only CSV and Excel files are allowed.")
        return self._infer_dataframe_types(dataframe)

    def compute_column_stats(self, df: pd.DataFrame) -> list[dict[str, Any]]:
        """Compute profiling statistics for each dataframe column."""

        row_count = len(df)
        results: list[dict[str, Any]] = []
        for column_name in df.columns:
            series = df[column_name]
            sample_values = self._sample_non_null_values(series)
            min_val: str | None = None
            max_val: str | None = None
            if pd.api.types.is_numeric_dtype(series) or pd.api.types.is_datetime64_any_dtype(series):
                non_null = series.dropna()
                if not non_null.empty:
                    min_val = self._stringify_scalar(non_null.min())
                    max_val = self._stringify_scalar(non_null.max())

            results.append(
                {
                    "name": str(column_name),
                    "dtype": series.dtype.name,
                    "null_count": int(series.isna().sum()),
                    "null_pct": round(float(series.isna().mean() * 100), 2) if row_count else 0.0,
                    "unique_count": int(series.nunique(dropna=True)),
                    "sample_values": sample_values,
                    "min_val": min_val,
                    "max_val": max_val,
                }
            )
        return results

    def detect_basic_anomalies(self, df: pd.DataFrame, col: str, stats: dict[str, Any]) -> list[str]:
        """Detect fast, rule-based anomalies for a single column."""

        anomalies: list[str] = []
        series = df[col]
        row_count = len(df)

        if float(stats["null_pct"]) > 50:
            anomalies.append("More than 50% values missing")
        if int(stats["unique_count"]) == 1 and row_count > 0:
            anomalies.append("All values identical - possible constant column")

        if pd.api.types.is_numeric_dtype(series) and self._suggests_non_negative(col):
            numeric_series = pd.to_numeric(series, errors="coerce").dropna()
            if not numeric_series.empty and (numeric_series < 0).any():
                anomalies.append("Negative values found in a column that appears non-negative")

        if pd.api.types.is_string_dtype(series) and row_count > 0 and int(stats["unique_count"]) > row_count * 0.5:
            normalized = series.dropna().astype(str).str.strip()
            if not normalized.empty:
                lowercase_ratio = normalized.str.islower().mean()
                uppercase_ratio = normalized.str.isupper().mean()
                titlecase_ratio = normalized.str.istitle().mean()
                dominant_ratio = max(lowercase_ratio, uppercase_ratio, titlecase_ratio)
                if 0.2 < dominant_ratio < 0.8:
                    anomalies.append("Mixed case inconsistency detected across string values")

        return anomalies

    def _load_csv(self, path: Path) -> pd.DataFrame:
        """Load CSV data, chunking large files to control memory spikes."""

        encoding = self._detect_csv_encoding(path)
        row_count = self._count_csv_rows(path)
        separator = self._detect_csv_separator(path, encoding)
        if row_count > self.large_file_threshold:
            chunks = self._read_csv(path, encoding=encoding, separator=separator, chunksize=self.chunk_size)
            return pd.concat(chunks, ignore_index=True)
        return self._read_csv(path, encoding=encoding, separator=separator)

    def _load_excel(self, path: Path) -> pd.DataFrame:
        """Load the first sheet from an Excel workbook."""

        dataframe = pd.read_excel(path, sheet_name=0, dtype=str)
        if len(dataframe) > self.large_file_threshold:
            chunk_frames = [
                dataframe.iloc[start : start + self.chunk_size].copy()
                for start in range(0, len(dataframe), self.chunk_size)
            ]
            return pd.concat(chunk_frames, ignore_index=True)
        return dataframe

    def _count_csv_rows(self, path: Path) -> int:
        """Count rows in a CSV file excluding the header line."""

        encoding = self._detect_csv_encoding(path)
        with path.open("r", encoding=encoding, newline="") as handle:
            return max(sum(1 for _ in handle) - 1, 0)

    def _read_csv(
        self,
        path: Path,
        *,
        encoding: str,
        separator: str,
        chunksize: int | None = None,
    ) -> pd.DataFrame | pd.io.parsers.TextFileReader:
        """Read CSV data with the discovered encoding and separator."""

        return pd.read_csv(
            path,
            dtype=str,
            keep_default_na=True,
            encoding=encoding,
            sep=separator,
            chunksize=chunksize,
        )

    def _detect_csv_encoding(self, path: Path) -> str:
        """Return the first workable encoding for the CSV file."""

        for encoding in self.CSV_ENCODINGS:
            try:
                with path.open("r", encoding=encoding, newline="") as handle:
                    handle.read(4096)
                return encoding
            except UnicodeDecodeError:
                continue
        raise ValueError(
            "Unable to decode the uploaded CSV file. Please save it as UTF-8, ANSI, or Excel and upload again."
        )

    def _detect_csv_separator(self, path: Path, encoding: str) -> str:
        """Infer the most likely separator from the CSV header and sample rows."""

        with path.open("r", encoding=encoding, newline="") as handle:
            sample = handle.read(8192)

        lines = [line for line in sample.splitlines() if line.strip()]
        if not lines:
            return ","

        score_by_separator: dict[str, int] = {}
        for separator in self.CSV_SEP_CANDIDATES:
            counts = [line.count(separator) for line in lines[:5]]
            score_by_separator[separator] = sum(counts)

        best_separator = max(score_by_separator, key=score_by_separator.get)
        return best_separator if score_by_separator[best_separator] > 0 else ","

    def _infer_dataframe_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """Infer booleans, numerics, and datetimes from string-loaded columns."""

        converted = df.copy()
        for column_name in converted.columns:
            series = converted[column_name]
            if not pd.api.types.is_object_dtype(series) and not pd.api.types.is_string_dtype(series):
                continue

            normalized = series.replace(r"^\s*$", pd.NA, regex=True)
            converted[column_name] = normalized
            non_null = normalized.dropna()
            if non_null.empty:
                continue

            bool_series = self._try_parse_bool(normalized)
            if bool_series is not None:
                converted[column_name] = bool_series
                continue

            numeric_series = pd.to_numeric(normalized, errors="coerce")
            if numeric_series.notna().sum() == len(non_null):
                converted[column_name] = numeric_series
                continue

            datetime_series = self._try_parse_datetime(normalized)
            if datetime_series is not None and datetime_series.notna().sum() == len(non_null):
                converted[column_name] = datetime_series
        return converted

    def _try_parse_bool(self, series: pd.Series) -> pd.Series | None:
        """Parse a series into booleans when values fit a boolean vocabulary."""

        mapping = {
            "true": True,
            "false": False,
            "yes": True,
            "no": False,
            "y": True,
            "n": False,
            "1": True,
            "0": False,
        }
        non_null = series.dropna().astype(str).str.strip().str.lower()
        if non_null.empty or not non_null.isin(mapping).all():
            return None

        parsed = series.astype("object").copy()
        for index, value in series.items():
            if pd.isna(value):
                parsed.at[index] = pd.NA
            else:
                parsed.at[index] = mapping[str(value).strip().lower()]
        return parsed.astype("boolean")

    def _sample_non_null_values(self, series: pd.Series) -> list[str]:
        """Return up to five random non-null sample values as strings."""

        candidates = series.dropna().astype(str).tolist()
        if not candidates:
            return []
        sample_size = min(5, len(candidates))
        if len(candidates) <= sample_size:
            return candidates[:sample_size]
        return self._sampler.sample(candidates, sample_size)

    def _try_parse_datetime(self, series: pd.Series) -> pd.Series | None:
        """Parse a series into datetimes only when values look consistently date-like."""

        non_null = series.dropna().astype(str).str.strip()
        if non_null.empty:
            return None

        sample_values = non_null.head(min(25, len(non_null)))
        date_like_ratio = sample_values.map(self._looks_datetime_like).mean()
        if date_like_ratio < 0.8:
            return None

        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message="Could not infer format, so each element will be parsed individually, falling back to `dateutil`.*",
                category=UserWarning,
            )
            parsed = pd.to_datetime(series, errors="coerce", utc=False)
        return parsed

    def _looks_datetime_like(self, value: str) -> bool:
        """Return whether a string resembles a common date or datetime shape."""

        normalized = value.strip()
        if not normalized:
            return False

        separators = ("-", "/", ":")
        has_date_separator = sum(separator in normalized for separator in separators[:2]) >= 1
        has_time_marker = ":" in normalized
        digit_count = sum(character.isdigit() for character in normalized)
        alpha_month_hint = any(token in normalized.lower() for token in ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))
        return (has_date_separator and digit_count >= 6) or has_time_marker or alpha_month_hint

    def _suggests_non_negative(self, column_name: str) -> bool:
        """Return whether a column name implies non-negative values."""

        lowered = column_name.lower()
        keywords = {"age", "count", "amount", "price"}
        return any(keyword in lowered for keyword in keywords)

    def _stringify_scalar(self, value: Any) -> str | None:
        """Convert a scalar value to a JSON-safe string."""

        if pd.isna(value):
            return None
        return str(value)
