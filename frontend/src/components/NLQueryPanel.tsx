import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Database,
  History,
  Search,
  Sparkles,
  TableProperties,
  WandSparkles,
} from "lucide-react";
import { getQueryHistory, sendNLQuery } from "../api/pipeline";
import type { ColumnAnalysis, JobResult, QueryHistory, QueryResponse } from "../types";

interface NLQueryPanelProps {
  result: JobResult;
}

type SortDirection = "asc" | "desc";

interface QuerySuggestion {
  label: string;
  question: string;
  tone?: "default" | "issue" | "insight";
}

function isNumericColumn(column: ColumnAnalysis): boolean {
  return ["int64", "float64", "Int64", "Float64"].includes(column.dtype);
}

function buildQuerySuggestions(columns: ColumnAnalysis[]): QuerySuggestion[] {
  const suggestions: QuerySuggestion[] = [];
  const numericColumns = columns.filter(isNumericColumn);
  const issueColumns = columns.filter((column) => column.anomalies.length > 0 || column.null_pct > 0);
  const likelyDateColumn = columns.find(
    (column) =>
      column.ai_inferred_type.toLowerCase().includes("date") ||
      column.dtype.toLowerCase().includes("datetime"),
  );
  const likelyEmailColumn = columns.find((column) =>
    column.ai_inferred_type.toLowerCase().includes("email"),
  );

  if (numericColumns.length > 0) {
    const column = numericColumns[0];
    suggestions.push({
      label: `High ${column.name}`,
      question: `Show rows where ${column.name} > ${column.max_val ?? "0"}`,
      tone: "insight",
    });
  }

  if (issueColumns.length > 0) {
    const column = issueColumns[0];
    suggestions.push({
      label: `Missing ${column.name}`,
      question: `Find rows with missing ${column.name}`,
      tone: "issue",
    });
  }

  if (likelyDateColumn) {
    suggestions.push({
      label: `${likelyDateColumn.name} present`,
      question: `Show rows where ${likelyDateColumn.name} is not missing`,
      tone: "default",
    });
  }

  if (likelyEmailColumn) {
    suggestions.push({
      label: `Review ${likelyEmailColumn.name}`,
      question: `Show rows where ${likelyEmailColumn.name} contains @`,
      tone: "default",
    });
  }

  for (const column of columns) {
    if (suggestions.length >= 5) {
      break;
    }

    if (column.unique_count > 1 && column.unique_count <= 12) {
      const sample = column.sample_values.find((value) => String(value).trim().length > 0);
      if (sample) {
        suggestions.push({
          label: `${column.name}: ${String(sample)}`,
          question: `Show rows where ${column.name} equals ${String(sample)}`,
          tone: "default",
        });
      }
    }
  }

  if (suggestions.length < 5 && numericColumns.length > 0) {
    const column = numericColumns[0];
    suggestions.push({
      label: `Sort by ${column.name}`,
      question: `Show rows where ${column.name} is not missing`,
      tone: "insight",
    });
  }

  return suggestions.slice(0, 5);
}

function buildColumnSpotlights(columns: ColumnAnalysis[]): ColumnAnalysis[] {
  return [...columns]
    .sort((left, right) => {
      const leftScore = left.anomalies.length * 100 + left.null_pct;
      const rightScore = right.anomalies.length * 100 + right.null_pct;
      return rightScore - leftScore;
    })
    .slice(0, 4);
}

export function NLQueryPanel({ result }: NLQueryPanelProps) {
  const [question, setQuestion] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loadingStep, setLoadingStep] = useState(0);

  const contextualSuggestions = useMemo(
    () => buildQuerySuggestions(result.column_analyses),
    [result.column_analyses],
  );
  const spotlightColumns = useMemo(
    () => buildColumnSpotlights(result.column_analyses),
    [result.column_analyses],
  );
  const loadingMessages = useMemo(
    () => [
      "Reading your natural language question...",
      "Mapping it to the dataset schema...",
      "Generating a safe pandas expression...",
      "Running the filtered result set...",
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const history = await getQueryHistory(result.job_id);
        if (!cancelled) {
          setQueryHistory(history.slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setQueryHistory([]);
        }
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [result.job_id]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingStep((current) => (current < loadingMessages.length - 1 ? current + 1 : current));
    }, 1200);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading, loadingMessages.length]);

  const sortedData = useMemo(() => {
    if (!queryResult) {
      return [];
    }
    const rows = [...queryResult.data];
    if (!sortColumn) {
      return rows;
    }
    rows.sort((left, right) => {
      const leftValue = left[sortColumn];
      const rightValue = right[sortColumn];
      if (leftValue === rightValue) {
        return 0;
      }
      const leftString = String(leftValue ?? "");
      const rightString = String(rightValue ?? "");
      const comparison = leftString.localeCompare(rightString, undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [queryResult, sortColumn, sortDirection]);

  async function refreshHistory() {
    try {
      const history = await getQueryHistory(result.job_id);
      setQueryHistory(history.slice(0, 5));
    } catch {
      setQueryHistory([]);
    }
  }

  async function runQuery(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();
    if (!finalQuestion) {
      setError("Enter a question to query your data.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuestion(finalQuestion);

    try {
      const response = await sendNLQuery({ job_id: result.job_id, question: finalQuestion });
      setQueryResult(response);
      await refreshHistory();
      setSortColumn(null);
      setSortDirection("asc");
    } catch (queryError) {
      const message =
        queryError instanceof Error ? queryError.message : "Query failed.";
      setError(
        message.includes("timeout")
          ? "The query took longer than expected. Try a simpler filter or run it again."
          : message,
      );
    } finally {
      setIsLoading(false);
    }
  }

  function onSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  function applyColumnPrompt(column: ColumnAnalysis) {
    const nextQuestion =
      column.anomalies.length > 0 || column.null_pct > 0
        ? `Show rows where ${column.name} is missing`
        : `Show rows where ${column.name} is not missing`;
    setQuestion(nextQuestion);
  }

  return (
    <section className="query-shell">
      <div className="query-main glass-panel">
        <div className="query-header">
          <div>
            <p className="eyebrow">Natural language query</p>
            <h2>Ask the AI assistant about this specific dataset</h2>
            <p className="query-header-copy">
              Suggestions below are generated from the uploded file.
            </p>
          </div>
          <span className="feature-pill">
            <Sparkles size={13} />
            Gemini powered
          </span>
        </div>

        <div className="query-context-grid">
          <div className="query-context-card">
            <div className="query-context-icon">
              <TableProperties size={16} />
            </div>
            <div>
              <span className="query-context-label">Dataset profile</span>
              <strong>
                {result.row_count.toLocaleString()} rows · {result.column_count} columns
              </strong>
            </div>
          </div>
          <div className="query-context-card">
            <div className="query-context-icon">
              <Database size={16} />
            </div>
            <div>
              <span className="query-context-label">Active spotlights</span>
              <strong>{spotlightColumns.length} columns worth reviewing</strong>
            </div>
          </div>
        </div>

        <div className="query-input-row">
          <input
            className="query-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about your uploaded data..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void runQuery();
              }
            }}
          />
          <button className="primary-button" type="button" disabled={isLoading} onClick={() => void runQuery()}>
            <Search size={16} />
            {isLoading ? "Running..." : "Run query"}
          </button>
        </div>

        <div className="query-suggestion-section">
          <div className="query-section-heading">
            <div className="model-panel-heading">
              <WandSparkles size={16} />
              <strong>Suggested prompts for this file</strong>
            </div>
            <span className="section-label">Live from detected schema</span>
          </div>
          <div className="example-chip-row">
            {contextualSuggestions.map((example) => (
              <button
                key={example.question}
                type="button"
                className={`example-chip ${example.tone ?? "default"}`}
                onClick={() => void runQuery(example.question)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <div className="query-spotlight-section">
          <div className="query-section-heading">
            <strong>Column spotlights</strong>
            <span className="section-label">Tap a column to draft a focused prompt</span>
          </div>
          <div className="query-spotlight-grid">
            {spotlightColumns.map((column) => (
              <button
                key={column.name}
                type="button"
                className="query-spotlight-card"
                onClick={() => applyColumnPrompt(column)}
              >
                <div className="query-spotlight-top">
                  <strong>{column.name}</strong>
                  <span>{column.ai_inferred_type}</span>
                </div>
                <p>
                  {column.anomalies[0] ??
                    `${column.null_pct}% missing values detected in this field.`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        {isLoading ? (
          <div className="query-loading-card">
            <div className="query-loading-orb">
              <Sparkles size={18} className="spin" />
            </div>
            <div>
              <strong>{loadingMessages[loadingStep]}</strong>
              <p>The assistant is translating your request into a safe dataframe query.</p>
            </div>
          </div>
        ) : null}

        {queryResult ? (
          <div className="query-results">
            <div className="query-meta">
              <span>{queryResult.row_count} rows matched</span>
              <code>Pandas: {queryResult.pandas_expression}</code>
            </div>
            <p className="query-explanation">{queryResult.explanation}</p>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    {queryResult.columns.map((column) => (
                      <th key={column}>
                        <button type="button" className="sort-button" onClick={() => onSort(column)}>
                          {column}
                          <ArrowUpDown size={13} />
                          {sortColumn === column ? (
                            <span>{sortDirection === "asc" ? "Up" : "Down"}</span>
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((row, rowIndex) => (
                    <tr key={`query-row-${rowIndex}`}>
                      {queryResult.columns.map((column) => (
                        <td key={`${rowIndex}-${column}`}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !isLoading && (
            <div className="query-empty-state">
              <Sparkles size={20} />
              <div>
                <strong>Start with one of the suggested prompts</strong>
                <p>
                  SmartPipeline will generate a safe pandas filter, explain the query, and return
                  the first matching rows for review.
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <aside className="query-sidebar glass-panel">
        <div className="sidebar-header">
          <History size={16} />
          <h3>Recent queries</h3>
        </div>
        <div className="history-list">
          {queryHistory.length > 0 ? (
            queryHistory.map((historyItem) => (
              <button
                key={`${historyItem.created_at}-${historyItem.question}`}
                type="button"
                className="history-card"
                onClick={() => void runQuery(historyItem.question)}
              >
                <strong>{historyItem.question}</strong>
                <span>{historyItem.row_count} rows</span>
              </button>
            ))
          ) : (
            <p className="history-empty">No query history yet.</p>
          )}
        </div>
      </aside>
    </section>
  );
}
