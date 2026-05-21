import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, Sparkles } from "lucide-react";
import { useJobPoller } from "../hooks/useJobPoller";
import type { JobResult } from "../types";

interface JobProgressProps {
  jobId: string;
  filename: string;
  onComplete: (result: JobResult) => void;
}

function getProgressMessage(progress: number): string {
  if (progress < 10) {
    return "Uploading...";
  }
  if (progress < 35) {
    return "Reading file...";
  }
  if (progress < 60) {
    return "Computing statistics...";
  }
  if (progress < 90) {
    return "Running AI analysis...";
  }
  if (progress < 100) {
    return "Generating insights...";
  }
  return "Complete!";
}

const PROCESS_STEPS = [
  { label: "Upload received", threshold: 0 },
  { label: "Reading dataset", threshold: 25 },
  { label: "Computing statistics", threshold: 50 },
  { label: "Running AI analysis", threshold: 75 },
  { label: "Generating insights", threshold: 100 },
];

export function JobProgress({ jobId, filename, onComplete }: JobProgressProps) {
  const { status, progress, result, error } = useJobPoller(jobId);
  const hasCompletedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const targetProgress =
      status === "SUCCESS" && progress >= 100 ? 100 : Math.min(progress, 96);

    const interval = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= targetProgress) {
          window.clearInterval(interval);
          return current;
        }

        const remaining = targetProgress - current;
        const step = remaining > 20 ? 4 : remaining > 10 ? 3 : remaining > 4 ? 2 : 1;
        const next = Math.min(current + step, targetProgress);

        if (next >= targetProgress) {
          window.clearInterval(interval);
        }

        return next;
      });
    }, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, [progress, status]);

  useEffect(() => {
    if (status === "SUCCESS" && result && !hasCompletedRef.current) {
      if (displayProgress < 100) {
        return;
      }

      hasCompletedRef.current = true;
      completionTimerRef.current = window.setTimeout(() => {
        onComplete(result);
      }, 900);
    }

    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [displayProgress, onComplete, result, status]);

  const currentMessage = getProgressMessage(displayProgress);

  return (
    <section className="progress-shell">
      <div className="panel-heading progress-heading">
        <div className="progress-header-copy">
          <span className="hero-badge subtle">
            <LoaderCircle size={14} className="spin" />
            Live orchestration workflow
          </span>
          <p className="eyebrow">Processing job</p>
          <h2>{filename}</h2>
          <p className="progress-subtitle">
            Your dataset is moving through SmartPipeline&apos;s multi-stage AI quality workflow.
          </p>
        </div>
        <span className={`status-badge ${status?.toLowerCase() ?? "pending"}`}>{status ?? "PENDING"}</span>
      </div>

      <div className="progress-feature-row">
        <div className="progress-insight-card glass-panel">
          <Clock3 size={18} />
          <div>
            <span className="shell-status-label">Current stage</span>
            <strong>{currentMessage}</strong>
          </div>
        </div>
        <div className="progress-insight-card glass-panel">
          <Sparkles size={18} />
          <div>
            <span className="shell-status-label">Progress</span>
            <strong>{displayProgress}% complete</strong>
          </div>
        </div>
      </div>

      <div className="progress-track premium-progress-track">
        <div className="progress-fill premium-progress-fill" style={{ width: `${displayProgress}%` }} />
      </div>

      <div className="progress-meta">
        <strong>{currentMessage}</strong>
        <span>{displayProgress}%</span>
      </div>

      <div className="timeline-panel glass-panel">
        {PROCESS_STEPS.map((step, index) => {
          const isComplete = displayProgress >= step.threshold;
          const isCurrent =
            displayProgress < 100
              ? displayProgress >= step.threshold &&
                (index === PROCESS_STEPS.length - 1 ||
                  displayProgress < PROCESS_STEPS[index + 1].threshold)
              : index === PROCESS_STEPS.length - 1;
          return (
            <div
              key={step.label}
              className={`timeline-step ${isComplete ? "complete" : ""} ${isCurrent ? "current" : ""}`}
            >
              <div className="timeline-bullet">{isComplete ? <CheckCircle2 size={14} /> : index + 1}</div>
              <div>
                <strong>{step.label}</strong>
                <span>{isCurrent ? "In progress" : isComplete ? "Completed" : "Waiting"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {status === "SUCCESS" && displayProgress === 100 && (
        <div className="success-banner">
          <CheckCircle2 size={18} />
          Analysis finished successfully.
        </div>
      )}

      {status === "FAILURE" && (
        <div className="failure-banner">
          <AlertTriangle size={18} />
          {error ?? "The processing job failed."}
        </div>
      )}
    </section>
  );
}
