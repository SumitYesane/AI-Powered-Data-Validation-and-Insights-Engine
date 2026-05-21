"""Natural-language data query engine for SmartPipeline."""

from __future__ import annotations

import ast
import json
import re
from typing import Any

import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI


class _ExpressionValidator(ast.NodeVisitor):
    """Validate generated expressions against a constrained pandas subset."""

    allowed_nodes = (
        ast.Expression,
        ast.BoolOp,
        ast.BinOp,
        ast.UnaryOp,
        ast.Compare,
        ast.Call,
        ast.Name,
        ast.Load,
        ast.Attribute,
        ast.Subscript,
        ast.Constant,
        ast.List,
        ast.Tuple,
        ast.keyword,
        ast.And,
        ast.Or,
        ast.Not,
        ast.Eq,
        ast.NotEq,
        ast.Gt,
        ast.GtE,
        ast.Lt,
        ast.LtE,
        ast.In,
        ast.NotIn,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Mod,
        ast.BitAnd,
        ast.BitOr,
        ast.BitXor,
        ast.Invert,
    )
    allowed_names = {"df", "pd", "True", "False", "None"}
    allowed_methods = {
        "astype",
        "casefold",
        "contains",
        "endswith",
        "eq",
        "fillna",
        "isna",
        "isin",
        "lower",
        "notna",
        "strip",
        "startswith",
        "upper",
    }
    blocked_tokens = {"eval", "exec", "import", "open", "os", "sys", "__"}

    def validate(self, expression: str) -> None:
        """Validate the generated expression before execution."""

        if len(expression) > 500:
            raise ValueError("Query expression too long")
        lowered = expression.lower()
        if any(token in lowered for token in self.blocked_tokens):
            raise ValueError("Expression contains blocked tokens.")
        tree = ast.parse(expression, mode="eval")
        self.visit(tree)

    def visit(self, node: ast.AST) -> Any:
        """Reject unsupported AST nodes."""

        if not isinstance(node, self.allowed_nodes):
            raise ValueError(f"Unsupported expression syntax: {type(node).__name__}")
        return super().visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        """Allow only safe identifiers."""

        if node.id not in self.allowed_names:
            raise ValueError(f"Unsupported identifier: {node.id}")

    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Allow only safe attribute access and method names."""

        self.visit(node.value)
        if node.attr.startswith("_"):
            raise ValueError("Private attributes are not allowed.")
        if isinstance(node.value, ast.Name) and node.value.id == "pd" and node.attr != "to_datetime":
            raise ValueError(f"Unsupported pandas helper: {node.attr}")

    def visit_Call(self, node: ast.Call) -> None:
        """Allow only approved method calls on dataframe columns or pandas helpers."""

        if not isinstance(node.func, ast.Attribute):
            raise ValueError("Only attribute calls are allowed in query expressions.")
        if isinstance(node.func.value, ast.Name) and node.func.value.id == "pd":
            if node.func.attr != "to_datetime":
                raise ValueError(f"Unsupported pandas helper: {node.func.attr}")
        elif node.func.attr not in self.allowed_methods:
            raise ValueError(f"Unsupported method: {node.func.attr}")
        self.visit(node.func)
        for arg in node.args:
            self.visit(arg)
        for keyword in node.keywords:
            self.visit(keyword.value)


class NLQueryEngine:
    """Generate and safely execute dataframe filters from natural language."""

    def __init__(self, gemini_api_key: str):
        """Initialize the Gemini model client for query translation."""

        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=gemini_api_key,
            temperature=0.0,
        )
        self._validator = _ExpressionValidator()

    def generate_pandas_expression(self, question: str, column_schema: list[dict[str, Any]]) -> dict[str, str]:
        """Translate a natural-language question into a pandas boolean expression."""

        heuristic_expression = self._build_rule_based_expression(question, column_schema)
        if heuristic_expression is not None:
            self._validator.validate(heuristic_expression["expression"])
            return heuristic_expression

        schema_summary = json.dumps(
            [
                {
                    "name": str(column.get("name", "")),
                    "dtype": str(column.get("dtype", "")),
                    "ai_inferred_type": str(column.get("ai_inferred_type", "unknown")),
                }
                for column in column_schema
            ],
            ensure_ascii=True,
        )
        prompt = (
            "You are a Pandas expert. Convert the natural language query to a valid Python Pandas boolean filter expression.\n"
            f" Available columns: {schema_summary}\n"
            " Rules:\n"
            ' 1. Return ONLY JSON: {"expression": str, "explanation": str}\n'
            " 2. expression must be a valid Python boolean expression using df['col'] syntax\n"
            " 3. For string comparisons use .str.contains() or == \n"
            " 4. For null checks use .isna() or .notna()\n"
            " 5. Never use eval(), exec(), import, open, os, sys in the expression\n"
            ' 6. If the query cannot be answered with available columns, return {"expression": "df.index.notna()", "explanation": "Query not applicable \u2014 returning all rows"}\n'
            f" Query: {question}"
        )

        response = self.llm.invoke(prompt)
        content = self._content_to_text(response.content)
        payload = self._parse_json(content)
        expression = str(payload.get("expression", "df.index.notna()"))
        explanation = str(payload.get("explanation", "Query not applicable - returning all rows"))
        self._validator.validate(expression)
        return {"expression": expression, "explanation": explanation}

    def _build_rule_based_expression(
        self,
        question: str,
        column_schema: list[dict[str, Any]],
    ) -> dict[str, str] | None:
        """Handle common natural-language filters deterministically before using AI."""

        normalized_question = " ".join(question.strip().split())
        lowered_question = normalized_question.casefold()
        if not lowered_question:
            return None

        columns_by_name = {
            str(column.get("name", "")).casefold(): str(column.get("name", ""))
            for column in column_schema
            if column.get("name")
        }

        equality_match = re.match(
            r"^(?:show|find|filter)?\s*rows?\s+where\s+(.+?)\s+(?:equals|is equal to|=)\s+(.+)$",
            lowered_question,
        )
        if equality_match:
            raw_column = equality_match.group(1).strip()
            raw_value = normalized_question[equality_match.end(1) + (len(normalized_question) - len(lowered_question)):].strip()
            resolved_column = columns_by_name.get(raw_column)
            if resolved_column:
                value_fragment = re.split(r"\s+(?:equals|is equal to|=)\s+", normalized_question, maxsplit=1, flags=re.IGNORECASE)
                if len(value_fragment) == 2:
                    literal_value = self._strip_wrapping_quotes(value_fragment[1].strip())
                    return self._build_equality_expression(resolved_column, literal_value, column_schema)

        missing_match = re.match(
            r"^(?:show|find|filter)?\s*rows?\s+where\s+(.+?)\s+is\s+missing$",
            lowered_question,
        )
        if missing_match:
            resolved_column = columns_by_name.get(missing_match.group(1).strip())
            if resolved_column:
                return {
                    "expression": f"df[{resolved_column!r}].isna()",
                    "explanation": f"Filtering rows where {resolved_column} is missing.",
                }

        not_missing_match = re.match(
            r"^(?:show|find|filter)?\s*rows?\s+where\s+(.+?)\s+(?:is not missing|is present|is not null)$",
            lowered_question,
        )
        if not_missing_match:
            resolved_column = columns_by_name.get(not_missing_match.group(1).strip())
            if resolved_column:
                return {
                    "expression": f"df[{resolved_column!r}].notna()",
                    "explanation": f"Filtering rows where {resolved_column} has a value.",
                }

        numeric_match = re.match(
            r"^(?:show|find|filter)?\s*rows?\s+where\s+(.+?)\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$",
            normalized_question,
        )
        if numeric_match:
            raw_column = numeric_match.group(1).strip().casefold()
            operator = numeric_match.group(2)
            value = numeric_match.group(3)
            resolved_column = columns_by_name.get(raw_column)
            if resolved_column:
                return {
                    "expression": f"pd.to_numeric(df[{resolved_column!r}], errors='coerce') {operator} {value}",
                    "explanation": f"Filtering rows where {resolved_column} {operator} {value}.",
                }

        contains_match = re.match(
            r"^(?:show|find|filter)?\s*rows?\s+where\s+(.+?)\s+contains\s+(.+)$",
            lowered_question,
        )
        if contains_match:
            raw_column = contains_match.group(1).strip()
            resolved_column = columns_by_name.get(raw_column)
            if resolved_column:
                value_fragment = re.split(r"\s+contains\s+", normalized_question, maxsplit=1, flags=re.IGNORECASE)
                if len(value_fragment) == 2:
                    needle = self._strip_wrapping_quotes(value_fragment[1].strip())
                    return {
                        "expression": (
                            f"df[{resolved_column!r}].fillna('').astype('string').str.contains({needle!r}, case=False, na=False)"
                        ),
                        "explanation": f"Filtering rows where {resolved_column} contains {needle}.",
                    }

        return None

    def _build_equality_expression(
        self,
        column_name: str,
        value: str,
        column_schema: list[dict[str, Any]],
    ) -> dict[str, str]:
        """Build an exact-match expression with type-aware handling."""

        column_dtype = next(
            (
                str(column.get("dtype", ""))
                for column in column_schema
                if str(column.get("name", "")) == column_name
            ),
            "",
        ).lower()

        if "int" in column_dtype or "float" in column_dtype:
            parsed_value = float(value) if "." in value else int(value)
            expression = f"pd.to_numeric(df[{column_name!r}], errors='coerce') == {parsed_value!r}"
        else:
            expression = (
                f"df[{column_name!r}].fillna('').astype('string').str.strip().str.casefold() == {value.casefold()!r}"
            )
        return {
            "expression": expression,
            "explanation": f"Filtering rows where {column_name} exactly matches {value}.",
        }

    def _strip_wrapping_quotes(self, value: str) -> str:
        """Remove surrounding quotes from a literal-like string value."""

        stripped = value.strip()
        if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
            return stripped[1:-1]
        return stripped

    def execute_safe(self, df: pd.DataFrame, expression: str) -> pd.DataFrame:
        """Evaluate a validated boolean expression in a restricted environment."""

        self._validator.validate(expression)
        SAFE_GLOBALS = {"__builtins__": {}, "df": df, "pd": pd}
        try:
            # SECURITY: eval is restricted to SAFE_GLOBALS which only contains df and pd
            # An attacker cannot access builtins, os, sys, or execute arbitrary code
            # Expression length is limited to 500 characters
            # Always validate that eval result is a boolean Series before using as mask
            mask = eval(expression, SAFE_GLOBALS, {})
            if not isinstance(mask, pd.Series):
                raise ValueError("Expression did not return a pandas Series.")
            if mask.dtype != bool and str(mask.dtype) != "boolean":
                raise ValueError("Expression must return a boolean Series.")
            aligned_mask = mask.reindex(df.index, fill_value=False)
            return df[aligned_mask].head(1000)
        except Exception:
            return df.iloc[0:0].copy()

    def _parse_json(self, content: str) -> dict[str, Any]:
        """Extract and parse JSON from model output."""

        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise ValueError("Model response did not contain valid JSON.")
        payload = json.loads(match.group(0))
        if not isinstance(payload, dict):
            raise ValueError("Model response JSON must be an object.")
        return payload

    def _content_to_text(self, content: Any) -> str:
        """Normalize model response content to plain text."""

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict) and item.get("text"):
                    parts.append(str(item["text"]))
                else:
                    parts.append(str(item))
            return "".join(parts)
        return str(content)
