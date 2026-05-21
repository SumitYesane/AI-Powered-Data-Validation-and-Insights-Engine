import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, Bot, DatabaseZap, FileStack, Info, ShieldCheck, Sparkles } from "lucide-react";
import { AboutSection } from "./components/AboutSection";
import { AnalysisDashboard } from "./components/AnalysisDashboard";
import { FileUpload } from "./components/FileUpload";
import { JobProgress } from "./components/JobProgress";
import { NLQueryPanel } from "./components/NLQueryPanel";
import type { JobResult, UploadResponse } from "./types";

type AppStage = "upload" | "processing" | "results" | "about";

export default function App() {
  const [stage, setStage] = useState<AppStage>("upload");
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [resultsTab, setResultsTab] = useState<"analysis" | "query">("analysis");

  const stageItems = useMemo(
    () => [
      { key: "upload", label: "Upload", icon: FileStack },
      { key: "processing", label: "Processing", icon: DatabaseZap },
      { key: "results", label: "Results", icon: BarChart3 },
      { key: "about", label: "About", icon: Info },
    ],
    [],
  );

  const stageIndex = useMemo(
    () => stageItems.findIndex((item) => item.key === stage),
    [stage, stageItems],
  );

  function onUploaded(response: UploadResponse) {
    setUpload(response);
    setResult(null);
    setStage("processing");
  }

  function onComplete(nextResult: JobResult) {
    setResult(nextResult);
    setStage("results");
  }

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />

      <header className="app-header glass-panel">
        <div className="header-main">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="brand">SmartPipeline</p>
              <span className="brand-subtitle">AI Data Quality Engine</span>
            </div>
          </div>

          <div className="header-copy">
            <div className="header-badges">
              <span className="hero-badge">
                <Bot size={14} />
                Premium AI SaaS workflow
              </span>
              <span className="hero-badge subtle">
                <ShieldCheck size={14} />
                Production-grade validation insights
              </span>
            </div>

            <h1>Turn raw operational files into trusted, queryable intelligence.</h1>
            <p className="tagline">
              SmartPipeline profiles your dataset, surfaces anomalies, drafts validation models,
              and gives teams an executive-grade interface for AI-assisted data quality review.
            </p>
          </div>
        </div>

        <aside className="header-cta-card">
          <p className="eyebrow">Launch posture</p>
          <h2>Built to feel like a real paid product.</h2>
          <p>
            Upload once, watch a guided AI workflow, and hand your team a polished validation
            cockpit for every dataset.
          </p>
          <button
            type="button"
            className="cta-inline-button"
            onClick={() => setStage(result ? "results" : upload ? "processing" : "upload")}
          >
            Open current workspace
            <ArrowRight size={16} />
          </button>
        </aside>
      </header>

      <nav className="stage-tabs" aria-label="Pipeline stages">
        {stageItems.map((item) => {
          const Icon = item.icon;
          const isActive = stage === item.key;
          const isEnabled =
            item.key === "upload" ||
            (item.key === "processing" && upload !== null) ||
            (item.key === "results" && result !== null) ||
            item.key === "about";

          return (
            <button
              key={item.key}
              type="button"
              className={`stage-tab ${isActive ? "active" : ""}`}
              disabled={!isEnabled}
              onClick={() => {
                if (isEnabled) {
                  setStage(item.key as AppStage);
                }
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="shell-status-row">
        <div className="shell-status-card glass-panel">
          <span className="shell-status-label">Workspace mode</span>
          <strong>
            {stage === "upload"
              ? "Dataset onboarding"
              : stage === "processing"
                ? "Processing orchestration"
                : stage === "results"
                  ? "Executive review"
                  : "Project details"}
          </strong>
        </div>
        <div className="shell-status-card glass-panel">
          <span className="shell-status-label">Pipeline progress</span>
          <strong>
            {stage === "about" ? "Reference section" : `Step ${stageIndex + 1} of ${stageItems.length - 1}`}
          </strong>
        </div>
      </section>

      <main className="app-main">
        <div className="view-frame">
          {stage === "upload" ? <FileUpload onUploaded={onUploaded} /> : null}

          {stage === "processing" && upload ? (
            <JobProgress jobId={upload.job_id} filename={upload.filename} onComplete={onComplete} />
          ) : null}

          {stage === "results" && result ? (
            <div className="results-shell">
              <div className="results-tab-strip">
                <button
                  type="button"
                  className={`tab-button ${resultsTab === "analysis" ? "active" : ""}`}
                  onClick={() => setResultsTab("analysis")}
                >
                  Analysis
                </button>
                <button
                  type="button"
                  className={`tab-button ${resultsTab === "query" ? "active" : ""}`}
                  onClick={() => setResultsTab("query")}
                >
                  Query data
                </button>
              </div>

              <div className="fade-in-panel">
                {resultsTab === "analysis" ? (
                  <AnalysisDashboard result={result} />
                ) : (
                  <NLQueryPanel result={result} />
                )}
              </div>
            </div>
          ) : null}

          {stage === "about" ? (
            <AboutSection />
          ) : null}
        </div>
      </main>
    </div>
  );
}
