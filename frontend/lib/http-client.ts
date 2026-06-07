/**
 * DocuMind HTTP Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Axios instance used for ALL REST calls.
 * SSE streaming uses native fetch (via lib/api.ts) routed through the same base.
 *
 * Token storage key: __DOCUMIND_TOKEN__ (set by auth-store + useLogin)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

// ─── Constants ────────────────────────────────────────────────────────────────

export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Full base URL used by httpClient AND by SSE fetch calls */
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

/** In-memory token key — NOT stored in localStorage (XSS protection) */
export const TOKEN_KEY = "__DOCUMIND_TOKEN__";

// Typed handle for the in-memory token kept on `window` (shared across the bundle).
declare global {
  interface Window {
    __DOCUMIND_TOKEN__?: string;
  }
}

export function getToken(): string {
  return typeof window !== "undefined" ? window.__DOCUMIND_TOKEN__ ?? "" : "";
}

export function setToken(token: string) {
  if (typeof window !== "undefined") window.__DOCUMIND_TOKEN__ = token;
}

export function clearToken() {
  if (typeof window !== "undefined") window.__DOCUMIND_TOKEN__ = undefined;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // HttpOnly cookie for refresh token
});

// ─── Request interceptor: inject access token ─────────────────────────────────

httpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: 401 → queue + refresh ─────────────────────────────

let isRefreshing = false;
type PendingItem = { resolve: (t: string) => void; reject: (e: unknown) => void };
let pendingQueue: PendingItem[] = [];

function drainQueue(token: string) {
  pendingQueue.forEach(({ resolve }) => resolve(token));
  pendingQueue = [];
}

function rejectQueue(err: unknown) {
  pendingQueue.forEach(({ reject }) => reject(err));
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
        if (original.headers) original.headers.Authorization = `Bearer ${token}`;
        return httpClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await httpClient.post<{ access_token: string }>(
        "/auth/refresh"
      );
      setToken(data.access_token);
      drainQueue(data.access_token);
      if (original.headers)
        original.headers.Authorization = `Bearer ${data.access_token}`;
      return httpClient(original);
    } catch (refreshErr) {
      rejectQueue(refreshErr);
      clearToken();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── apiRequest ───────────────────────────────────────────────────────────────
// The thin request helper the hand-written lib/api-client.ts is built on.

export interface ApiRequestOptions {
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

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

export default httpClient;
