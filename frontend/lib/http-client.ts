/**
 * DocuMind HTTP Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Exports:
 *   - `httpClient`   Axios instance (for manual use)
 *   - `apiRequest`   Generic typed fetch — used by generated client
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const httpClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // HttpOnly cookie for refresh token
});

// ─── Request Interceptor: attach in-memory access token ─────────────────────
httpClient.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? (window as any).__DOCUMIND_TOKEN__
      : undefined;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response Interceptor: 401 → auto-refresh ────────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function drainQueue(token: string) {
  pendingQueue.forEach(({ resolve }) => resolve(token));
  pendingQueue = [];
}
function rejectQueue(error: unknown) {
  pendingQueue.forEach(({ reject }) => reject(error));
  pendingQueue = [];
}

httpClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return httpClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await httpClient.post<{ access_token: string }>("/auth/refresh");
      const newToken = data.access_token;
      if (typeof window !== "undefined") {
        (window as any).__DOCUMIND_TOKEN__ = newToken;
      }
      drainQueue(newToken);
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return httpClient(original);
    } catch (refreshErr) {
      rejectQueue(refreshErr);
      if (typeof window !== "undefined") {
        (window as any).__DOCUMIND_TOKEN__ = undefined;
        window.location.href = "/login";
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── apiRequest ──────────────────────────────────────────────────────────────
// The generated client calls this. Thin wrapper around httpClient.

interface ApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  params?: Record<string, unknown>;
}

export async function apiRequest<T>({
  method,
  url,
  body,
  params,
}: ApiRequestOptions): Promise<T> {
  const { data } = await httpClient.request<T>({
    method,
    url,
    data: body,
    params,
  });
  return data;
}

// ─── Shared types ────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  error: { code: string; message: string; request_id?: string };
}

export default httpClient;
