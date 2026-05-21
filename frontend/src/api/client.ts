import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL,
  timeout: 120000,
});
