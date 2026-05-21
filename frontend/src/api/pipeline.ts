import { apiClient } from "./client";
import type {
  JobResult,
  JobStatus,
  QueryHistory,
  QueryRequest,
  QueryResponse,
  UploadResponse,
} from "../types";

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<UploadResponse>("/api/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await apiClient.get<JobStatus>(`/api/jobs/${jobId}/status`);
  return response.data;
}

export async function getJobResult(jobId: string): Promise<JobResult> {
  const response = await apiClient.get<JobResult>(`/api/jobs/${jobId}/result`);
  return response.data;
}

export async function sendNLQuery(request: QueryRequest): Promise<QueryResponse> {
  const response = await apiClient.post<QueryResponse>("/api/query", request);
  return response.data;
}

export async function getQueryHistory(jobId: string): Promise<QueryHistory[]> {
  const response = await apiClient.get<QueryHistory[]>(`/api/jobs/${jobId}/query-history`);
  return response.data;
}

export async function getSuggestedModel(jobId: string): Promise<string> {
  const response = await apiClient.get<string>(`/api/jobs/${jobId}/suggested-model`, {
    responseType: "text",
  });
  return response.data;
}
