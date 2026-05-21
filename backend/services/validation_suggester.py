"""Pydantic model generation helpers for SmartPipeline."""

from __future__ import annotations

import keyword
import re
from typing import Any


def suggest_pydantic_model(job_id: str, enriched_columns: list[dict[str, Any]]) -> str:
    """Generate a complete Pydantic v2 model from enriched column metadata."""

    import_lines = [
        "from pydantic import BaseModel, Field",
        "",
        f"# Generated for SmartPipeline job: {job_id}",
        "",
        "class DataRowModel(BaseModel):",
        '    """Generated validation model for SmartPipeline job data."""',
    ]

    field_lines: list[str] = []
    seen_names: set[str] = set()
    for column in enriched_columns:
        field_name = _unique_field_name(_normalize_field_name(str(column.get("name", "field"))), seen_names)
        seen_names.add(field_name)

        ai_type = str(column.get("ai_inferred_type", "unknown"))
        suggested_validation = str(column.get("suggested_validation", ""))
        python_type, field_args = _infer_field_definition(ai_type, column, suggested_validation)
        alias = str(column.get("name", field_name)).replace("\\", "\\\\").replace('"', '\\"')
        line = f'    {field_name}: {python_type} = Field(..., alias="{alias}"'
        if field_args:
            line += f", {field_args}"
        line += ")"
        field_lines.append(line)

    if not field_lines:
        field_lines.append("    placeholder: str = Field(..., min_length=1)")

    return "\n".join(import_lines + field_lines) + "\n"


def _normalize_field_name(column_name: str) -> str:
    """Convert an arbitrary column name into a valid Python field name."""

    normalized = re.sub(r"[^0-9a-zA-Z_]+", "_", column_name.strip().lower()).strip("_")
    if not normalized:
        normalized = "field"
    if normalized[0].isdigit():
        normalized = f"field_{normalized}"
    if keyword.iskeyword(normalized):
        normalized = f"{normalized}_field"
    return normalized


def _unique_field_name(field_name: str, seen_names: set[str]) -> str:
    """Ensure field names are unique inside the generated model."""

    candidate = field_name
    suffix = 2
    while candidate in seen_names:
        candidate = f"{field_name}_{suffix}"
        suffix += 1
    return candidate


def _infer_field_definition(
    ai_type: str,
    column: dict[str, Any],
    suggested_validation: str,
) -> tuple[str, str]:
    """Infer a Python type and Field constraints for a generated model field."""

    lowered_type = ai_type.lower()
    dtype = str(column.get("dtype", "")).lower()
    min_val = column.get("min_val")
    max_val = column.get("max_val")

    if lowered_type in {"patient_age"}:
        return "int", "ge=0, le=130"
    if lowered_type in {"revenue_amount"}:
        return "float", "ge=0"
    if lowered_type in {"email_address"}:
        return "str", r'pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"'
    if lowered_type in {"phone_number"}:
        return "str", r'pattern=r"^\+?[0-9()\-\s]{7,20}$"'
    if lowered_type in {"diagnosis_code_icd10"}:
        return "str", r'pattern=r"^[A-Z][0-9]{2}(\.[A-Z0-9]{1,4})?$"'
    if lowered_type in {"date_of_birth"}:
        return "str", r'pattern=r"^\d{4}-\d{2}-\d{2}$"'
    if lowered_type in {"patient_id", "generic_identifier", "medication_name", "free_text", "unknown"}:
        return "str", _string_constraints(suggested_validation)

    if "int" in dtype:
        constraints = []
        if min_val is not None:
            constraints.append(f"ge={_coerce_numeric(min_val)}")
        if max_val is not None:
            constraints.append(f"le={_coerce_numeric(max_val)}")
        return "int", ", ".join(constraints)
    if "float" in dtype or "double" in dtype or "numeric" in dtype:
        constraints = []
        if min_val is not None:
            constraints.append(f"ge={_coerce_numeric(min_val)}")
        if max_val is not None:
            constraints.append(f"le={_coerce_numeric(max_val)}")
        return "float", ", ".join(constraints)
    if "bool" in dtype:
        return "bool", ""
    return "str", _string_constraints(suggested_validation)


def _string_constraints(suggested_validation: str) -> str:
    """Infer basic string constraints from the AI validation hint."""

    extracted_args = re.findall(
        r"(?:min_length|max_length|pattern|ge|gt|le|lt)\s*=\s*(?:r?\"[^\"]*\"|r?'[^']*'|[^,\s]+)",
        suggested_validation,
    )
    if extracted_args:
        return ", ".join(extracted_args)
    return "min_length=1"


def _coerce_numeric(value: Any) -> str:
    """Normalize a numeric bound for code generation."""

    text = str(value)
    return text if "." in text else str(int(float(text)))
