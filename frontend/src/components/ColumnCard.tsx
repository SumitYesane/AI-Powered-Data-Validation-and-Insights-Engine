import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import type { ColumnAnalysis } from "../types";

interface ColumnCardProps {
  column: ColumnAnalysis;
  expanded: boolean;
  onToggle: () => void;
}

const typeClassMap: Record<string, string> = {
  patient_id: "type-indigo",
  patient_age: "type-blue",
  date_of_birth: "type-cyan",
  diagnosis_code_icd10: "type-rose",
  revenue_amount: "type-emerald",
  email_address: "type-violet",
  phone_number: "type-orange",
  generic_identifier: "type-slate",
  medication_name: "type-pink",
  free_text: "type-amber",
  unknown: "type-neutral",
  pending: "type-neutral",
};

function getTypeClass(type: string): string {
  return typeClassMap[type] ?? "type-neutral";
}

export function ColumnCard({ column, expanded, onToggle }: ColumnCardProps) {
  const nonNullPct = Number(Math.max(0, 100 - column.null_pct).toFixed(2));
  const chartData = [
    { name: "Null", value: Number(column.null_pct.toFixed(2)), fill: "#c4b5fd" },
    { name: "Non-null", value: nonNullPct, fill: "#7c3aed" },
  ];
  const previewSample = column.sample_values[0] ? String(column.sample_values[0]) : "No sample";
  const previewNote =
    column.anomalies[0] ??
    (column.null_pct > 0 ? `${column.null_pct}% missing values detected.` : "No anomalies detected.");

  return (
    <article className="column-card glass-panel">
      <button type="button" className="column-card-toggle" onClick={onToggle} aria-expanded={expanded}>
        <div className="column-card-header">
          <div>
            <h3>{column.name}</h3>
            <p className="column-dtype">{column.dtype}</p>
          </div>
          <div className="column-card-header-actions">
            <span className={`type-badge ${getTypeClass(column.ai_inferred_type)}`}>
              {column.ai_inferred_type}
            </span>
            <span className={`column-issue-indicator ${column.anomalies.length > 0 ? "warning" : "clean"}`}>
              {column.anomalies.length > 0 ? `${column.anomalies.length} issue${column.anomalies.length > 1 ? "s" : ""}` : "Clean"}
            </span>
            <span className={`column-toggle-icon ${expanded ? "open" : ""}`}>
              <ChevronDown size={18} />
            </span>
          </div>
        </div>
      </button>

      <div className="column-card-summary-row">
        <div className="stat-pill compact">
          <span>Nulls</span>
          <strong>{column.null_pct}%</strong>
        </div>
        <div className="stat-pill compact">
          <span>Unique</span>
          <strong>{column.unique_count}</strong>
        </div>
        <div className="stat-pill compact">
          <span>Preview</span>
          <strong>{previewSample}</strong>
        </div>
      </div>

      <div className="column-card-preview">
        <span className="column-card-preview-label">Quick read</span>
        <p>{previewNote}</p>
      </div>

      {expanded ? (
        <div className="column-card-content">
          <div className="sample-block">
            <p className="section-label">Sample values</p>
            <div className="sample-chips">
              {column.sample_values.length > 0 ? (
                column.sample_values.map((value, index) => (
                  <span key={`${column.name}-sample-${index}`} className="sample-chip">
                    {String(value)}
                  </span>
                ))
              ) : (
                <span className="sample-chip muted">No samples</span>
              )}
            </div>
          </div>

          {column.anomalies.length > 0 ? (
            <div className="anomaly-block">
              <p className="section-label">Anomalies</p>
              <div className="anomaly-pills">
                {column.anomalies.map((anomaly) => (
                  <span key={`${column.name}-${anomaly}`} className="warning-pill">
                    {anomaly}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="anomaly-block">
              <p className="section-label">Anomalies</p>
              <div className="empty-state-inline">No anomalies detected for this column.</div>
            </div>
          )}

          <div className="validation-block">
            <p className="section-label">Suggested validation</p>
            <pre>{column.suggested_validation}</pre>
          </div>

          <div className="mini-chart">
            <p className="section-label">Completeness</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </article>
  );
}
