import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Code2, Filter, ShieldAlert, Sparkles, Table2 } from "lucide-react";
import { getSuggestedModel } from "../api/pipeline";
import type { JobResult } from "../types";
import { ColumnCard } from "./ColumnCard";

interface AnalysisDashboardProps {
  result: JobResult;
}

export function AnalysisDashboard({ result }: AnalysisDashboardProps) {
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "model">("analysis");
  const [modelCode, setModelCode] = useState<string>("");
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedColumnKey, setExpandedColumnKey] = useState<string | null>(null);
  const [hasInitializedExpansion, setHasInitializedExpansion] = useState(false);

  const filteredColumns = useMemo(
    () =>
      result.column_analyses
        .map((column, index) => ({
          column,
          key: `${column.name}-${index}`,
          index,
        }))
        .filter(({ column }) => !showIssuesOnly || column.anomalies.length > 0),
    [result.column_analyses, showIssuesOnly],
  );

  const issueCount = useMemo(
    () => result.column_analyses.filter((column) => column.anomalies.length > 0).length,
    [result.column_analyses],
  );

  const aiStatus = useMemo(
    () => (result.column_analyses.some((column) => column.ai_inferred_type !== "pending") ? "Enriched" : "Baseline"),
    [result.column_analyses],
  );

  useEffect(() => {
    const priorityColumn = result.column_analyses.findIndex((column) => column.anomalies.length > 0);

    if (priorityColumn >= 0) {
      setExpandedColumnKey(`${result.column_analyses[priorityColumn].name}-${priorityColumn}`);
      setHasInitializedExpansion(true);
      return;
    }

    if (result.column_analyses.length > 0) {
      setExpandedColumnKey(`${result.column_analyses[0].name}-0`);
      setHasInitializedExpansion(true);
    }
  }, [result.column_analyses]);

  useEffect(() => {
    if (filteredColumns.length === 0) {
      setExpandedColumnKey(null);
      return;
    }

    if (expandedColumnKey && filteredColumns.some(({ key }) => key === expandedColumnKey)) {
      return;
    }

    if (!hasInitializedExpansion) {
      return;
    }

    if (expandedColumnKey === null) {
      return;
    }

    setExpandedColumnKey(filteredColumns[0].key);
  }, [expandedColumnKey, filteredColumns, hasInitializedExpansion]);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      if (activeTab !== "model" || modelCode) {
        return;
      }
      setIsModelLoading(true);
      setModelError(null);
      try {
        const model = await getSuggestedModel(result.job_id);
        if (!cancelled) {
          setModelCode(model);
        }
      } catch (error) {
        if (!cancelled) {
          setModelError(error instanceof Error ? error.message : "Failed to fetch suggested model.");
        }
      } finally {
        if (!cancelled) {
          setIsModelLoading(false);
        }
      }
    }

    void loadModel();
    return () => {
      cancelled = true;
    };
  }, [activeTab, modelCode, result.job_id]);

  async function onCopyModel() {
    if (!modelCode) {
      return;
    }
    await navigator.clipboard.writeText(modelCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function toggleColumn(columnKey: string) {
    setExpandedColumnKey((current) => (current === columnKey ? null : columnKey));
  }

  return (
    <section className="dashboard-shell">
      <header className="summary-header">
        <div className="summary-header-main">
          <span className="hero-badge">
            <Sparkles size={14} />
            Executive data quality review
          </span>
          <p className="eyebrow">Analysis complete</p>
          <h2>{result.filename}</h2>
          <p className="summary-metadata">
            {result.row_count.toLocaleString()} rows x {result.column_count.toLocaleString()} columns
          </p>
        </div>
        <div className="summary-note glass-panel">
          <Sparkles size={18} />
          <p>{result.ai_summary}</p>
        </div>
      </header>

      <section className="metric-grid">
        <article className="metric-card glass-panel">
          <span className="metric-label">Rows</span>
          <strong>{result.row_count.toLocaleString()}</strong>
          <p>Records profiled in the current dataset.</p>
        </article>
        <article className="metric-card glass-panel">
          <span className="metric-label">Columns</span>
          <strong>{result.column_count.toLocaleString()}</strong>
          <p>Fields inspected for type, completeness, and anomalies.</p>
        </article>
        <article className="metric-card glass-panel">
          <span className="metric-label">Issues found</span>
          <strong>{issueCount.toLocaleString()}</strong>
          <p>Columns requiring closer quality review or rule definition.</p>
        </article>
        <article className="metric-card glass-panel">
          <span className="metric-label">AI status</span>
          <strong>{aiStatus}</strong>
          <p>{aiStatus === "Enriched" ? "AI enrichment completed for this profile." : "Base profiling only."}</p>
        </article>
      </section>

      <div className="tab-strip">
        <button
          type="button"
          className={`tab-button ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => setActiveTab("analysis")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "model" ? "active" : ""}`}
          onClick={() => setActiveTab("model")}
        >
          Suggested Pydantic Model
        </button>
      </div>

      <div className="tab-panel">
        {activeTab === "analysis" ? (
          <>
            <div className="analysis-toolbar">
              <div className="analysis-toolbar-actions">
                <button
                  type="button"
                  className={`filter-chip ${showIssuesOnly ? "active" : ""}`}
                  onClick={() => setShowIssuesOnly((current) => !current)}
                >
                  <Filter size={15} />
                  Columns with issues
                </button>
              </div>
              <div className="analysis-toolbar-caption overview-caption">
                <span>{filteredColumns.length} columns in view</span>
                <span>{expandedColumnKey ? "1 open at a time" : "Tap a column to inspect"}</span>
              </div>
            </div>

            <div className="column-grid">
              {filteredColumns.map(({ column, key }) => (
                <ColumnCard
                  key={key}
                  column={column}
                  expanded={expandedColumnKey === key}
                  onToggle={() => toggleColumn(key)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="model-panel glass-panel">
            <div className="model-panel-header">
              <div className="model-panel-heading">
                <Code2 size={18} />
                <span>Generated validation model</span>
              </div>
              <button type="button" className="copy-button" onClick={() => void onCopyModel()} disabled={!modelCode}>
                <Clipboard size={15} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="model-context-row">
              <div className="model-context-pill">
                <Table2 size={14} />
                Derived from analyzed schema
              </div>
              <div className="model-context-pill">
                {issueCount > 0 ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
                {issueCount > 0 ? `${issueCount} flagged columns inform constraints` : "No major issues detected"}
              </div>
            </div>
            {isModelLoading ? <div className="code-skeleton" aria-hidden="true" /> : null}
            {modelError ? <p className="inline-error">{modelError}</p> : null}
            {modelCode ? <pre className="code-view">{modelCode}</pre> : null}
          </div>
        )}
      </div>
    </section>
  );
}
