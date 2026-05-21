"""Gemini-powered data quality analysis helpers for SmartPipeline."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


SYSTEM_PROMPT = """
You are a data quality expert. Analyze the provided CSV column statistics.
Return ONLY valid JSON. No markdown, no explanation outside the JSON.
JSON format: {"columns": [{"name": str, "ai_inferred_type": str, "anomalies": [str], "suggested_validation": str}]}
For ai_inferred_type, use domain-aware labels like: patient_id, date_of_birth, diagnosis_code_icd10,
medication_name, patient_age, revenue_amount, email_address, phone_number, generic_identifier, free_text, unknown.
For anomalies, describe domain-specific issues (e.g., "Age value 847 is biologically impossible",
"Revenue 2400000 is 400x the median - possible data entry error").
For suggested_validation, give a concrete Pydantic v2 validator hint.
""".strip()


class AIDataAnalyzer:
    """Use Gemini to enrich column profiles with domain-aware intelligence."""

    def __init__(self, gemini_api_key: str):
        """Initialize the Gemini chat client."""

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=gemini_api_key,
            temperature=0.0,
            max_output_tokens=2048,
        )

    def analyze_columns(self, column_stats: list[dict[str, Any]], filename: str) -> list[dict[str, Any]]:
        """Enrich column stats with AI-inferred types, anomalies, and validation hints."""

        compact_columns = [
            {
                "name": str(column.get("name", "")),
                "dtype": str(column.get("dtype", "")),
                "sample_values": self._truncate_samples(column.get("sample_values", [])),
                "basic_anomalies": list(column.get("anomalies", []))[:5],
            }
            for column in column_stats
        ]

        user_prompt = json.dumps({"filename": filename, "columns": compact_columns}, ensure_ascii=True)
        content = self._invoke_json_prompt(user_prompt)
        payload = self._parse_json_response(content)
        ai_columns = payload.get("columns", [])
        ai_by_name = {
            str(column.get("name", "")): column
            for column in ai_columns
            if isinstance(column, dict) and column.get("name")
        }

        enriched_columns: list[dict[str, Any]] = []
        for column in column_stats:
            ai_payload = ai_by_name.get(str(column.get("name", "")), {})
            merged_anomalies = self._merge_anomalies(
                list(column.get("anomalies", [])),
                ai_payload.get("anomalies", []),
            )
            enriched_column = dict(column)
            enriched_column["ai_inferred_type"] = str(ai_payload.get("ai_inferred_type", "unknown"))
            enriched_column["anomalies"] = merged_anomalies
            enriched_column["suggested_validation"] = str(
                ai_payload.get("suggested_validation", "Use Field constraints aligned to the observed values.")
            )
            enriched_columns.append(enriched_column)
        return enriched_columns

    def generate_summary(self, filename: str, row_count: int, enriched_columns: list[dict[str, Any]]) -> str:
        """Generate a concise executive summary of the dataset quality."""

        critical_issues = self._top_issues(enriched_columns, limit=3)
        summary_prompt = (
            "Write a brief 2-3 sentence executive summary of dataset quality. "
            "Return plain text only.\n"
            f"Filename: {filename}\n"
            f"Row count: {row_count}\n"
            f"Top issues: {json.dumps(critical_issues, ensure_ascii=True)}"
        )
        try:
            response = self.llm.invoke(
                [
                    ("system", "You are a senior data quality analyst. Return plain text only."),
                    ("human", summary_prompt),
                ]
            )
            text = self._content_to_text(response.content).strip()
            if text:
                return text
        except Exception:
            pass
        return self._fallback_summary(filename, row_count, enriched_columns)

    def _invoke_json_prompt(self, user_prompt: str) -> str:
        """Invoke Gemini and retry once with a JSON-fix prompt if parsing fails."""

        response = self.llm.invoke([("system", SYSTEM_PROMPT), ("human", user_prompt)])
        content = self._content_to_text(response.content)
        try:
            self._parse_json_response(content)
            return content
        except (json.JSONDecodeError, ValueError):
            repair_prompt = (
                "Your previous response was not valid JSON. "
                "Fix your JSON and return ONLY the corrected JSON object."
            )
            retry_response = self.llm.invoke(
                [
                    ("system", SYSTEM_PROMPT),
                    ("human", user_prompt),
                    ("human", repair_prompt),
                ]
            )
            return self._content_to_text(retry_response.content)

    def _parse_json_response(self, content: str) -> dict[str, Any]:
        """Extract and parse the JSON object from Gemini output."""

        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise ValueError("Gemini response did not contain a JSON object.")
        payload = json.loads(match.group(0))
        if not isinstance(payload, dict):
            raise ValueError("Gemini JSON payload must be an object.")
        return payload

    def _truncate_samples(self, sample_values: list[Any]) -> list[str]:
        """Truncate sample values for prompt efficiency."""

        truncated_samples: list[str] = []
        for value in list(sample_values)[:5]:
            text = str(value)
            truncated_samples.append(text[:50] + ("..." if len(text) > 50 else ""))
        return truncated_samples

    def _merge_anomalies(self, basic_anomalies: list[Any], ai_anomalies: Any) -> list[str]:
        """Merge rule-based anomalies with AI-provided anomalies."""

        merged: list[str] = []
        for item in list(basic_anomalies) + list(ai_anomalies or []):
            anomaly = str(item).strip()
            if anomaly and anomaly not in merged:
                merged.append(anomaly)
        return merged

    def _top_issues(self, enriched_columns: list[dict[str, Any]], limit: int) -> list[str]:
        """Collect the most important issues across columns."""

        issues: list[str] = []
        for column in enriched_columns:
            column_name = str(column.get("name", "unknown"))
            for anomaly in list(column.get("anomalies", [])):
                issues.append(f"{column_name}: {anomaly}")
        return issues[:limit]

    def _fallback_summary(self, filename: str, row_count: int, enriched_columns: list[dict[str, Any]]) -> str:
        """Build a deterministic summary when AI summary generation fails."""

        issues = self._top_issues(enriched_columns, limit=3)
        issue_text = "; ".join(issues) if issues else "No critical issues were identified."
        return (
            f"{filename} contains {row_count} rows and {len(enriched_columns)} analyzed columns. "
            f"Top data quality findings: {issue_text}"
        )

    def _content_to_text(self, content: Any) -> str:
        """Normalize LangChain response content into plain text."""

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
                else:
                    parts.append(str(item))
            return "".join(parts)
        return str(content)
