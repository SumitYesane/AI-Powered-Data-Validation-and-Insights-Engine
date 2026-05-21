export interface UploadResponse {
  job_id: string;
  filename: string;
  file_size_bytes: number;
  status: string;
}

export interface JobStatus {
  job_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
  progress: number;
  message: string;
}

export interface ColumnAnalysis {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  sample_values: Array<string | number | boolean | null>;
  min_val: string | null;
  max_val: string | null;
  ai_inferred_type: string;
  anomalies: string[];
  suggested_validation: string;
}

export interface JobResult {
  job_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  column_analyses: ColumnAnalysis[];
  ai_summary: string;
  processing_time_seconds: number;
}

export interface QueryRequest {
  job_id: string;
  question: string;
}

export interface QueryResponse {
  question: string;
  pandas_expression: string;
  row_count: number;
  columns: string[];
  data: Record<string, string | number | boolean | null>[];
  explanation: string;
}

export interface QueryHistory {
  question: string;
  pandas_expression: string;
  row_count: number;
  created_at: string;
}
