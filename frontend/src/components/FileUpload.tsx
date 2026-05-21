import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import {
  BrainCircuit,
  FileSpreadsheet,
  LoaderCircle,
  MessageSquareCode,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { uploadFile } from "../api/pipeline";
import type { UploadResponse } from "../types";

interface FileUploadProps {
  onUploaded: (response: UploadResponse) => void;
}

const ACCEPTED_TYPES = ".csv,.xlsx,.xls";
const FEATURE_CARDS = [
  {
    icon: BrainCircuit,
    title: "AI schema inference",
    description: "Map raw columns into domain-aware types with premium AI profiling.",
  },
  {
    icon: ShieldCheck,
    title: "Data quality checks",
    description: "Surface completeness, duplication, and anomaly patterns at a glance.",
  },
  {
    icon: MessageSquareCode,
    title: "Natural language querying",
    description: "Interrogate uploaded data in plain English without leaving the dashboard.",
  },
  {
    icon: Sparkles,
    title: "Validation model generation",
    description: "Draft a Pydantic model from observed schema and validation suggestions.",
  },
];

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ onUploaded }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileTypeLabel = useMemo(() => {
    if (!file) {
      return null;
    }
    const extension = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
    return extension;
  }, [file]);

  function handleFileSelection(selectedFile: File | null) {
    setError(null);
    setFile(selectedFile);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFileSelection(event.target.files?.[0] ?? null);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
  }

  async function onUploadClick() {
    if (!file) {
      setError("Select a CSV or Excel file to continue.");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const response = await uploadFile(file);
      onUploaded(response);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="upload-shell">
      <div className="upload-hero">
        <div className="upload-intro">
          <span className="hero-badge">
            <Sparkles size={14} />
            Premium onboarding experience
          </span>
          <h2>Bring one file. Leave with a complete AI quality review.</h2>
          <p>
            SmartPipeline transforms incoming spreadsheets into an executive-grade validation
            workspace with schema insight, anomaly review, model generation, and query assistance.
          </p>

          <div className="feature-grid">
            {FEATURE_CARDS.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="feature-card">
                  <div className="feature-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="upload-panel glass-panel">
          <div
            className={`dropzone ${dragActive ? "dropzone-active" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input
              className="dropzone-input"
              id="file-upload-input"
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={onInputChange}
            />
            <label htmlFor="file-upload-input" className="dropzone-label">
              <div className="dropzone-icon">
                <UploadCloud size={30} />
              </div>
              <h2>Drop your dataset here</h2>
              <p>CSV, XLSX, or XLS up to 50 MB. Drag, drop, or browse to begin analysis.</p>
              <span className="browse-button">Select file</span>
            </label>
          </div>

          <div className="upload-panel-footer">
            <div className="micro-copy">
              <span className="micro-copy-label">On upload</span>
              <strong>Schema inference, anomaly review, AI summary, and model generation</strong>
            </div>
          </div>
        </div>
      </div>

      {file && (
        <div className="selected-file-card glass-panel">
          <div className="selected-file-main">
            <div className="selected-file-icon">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <p className="selected-file-name">{file.name}</p>
              <p className="selected-file-meta">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <span className="file-type-badge">{fileTypeLabel}</span>
        </div>
      )}

      {error && <p className="inline-error">{error}</p>}

      <button className="primary-button premium-cta" type="button" onClick={onUploadClick} disabled={isUploading}>
        {isUploading ? (
          <>
            <LoaderCircle className="spin" size={16} />
            Uploading...
          </>
        ) : (
          "Upload and analyze"
        )}
      </button>
    </section>
  );
}
