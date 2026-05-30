import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Singleton axios instance
const httpClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include HttpOnly cookies for refresh token
});

// ─── Request Interceptor: attach access token ──────────────────────────────
httpClient.interceptors.request.use((config) => {
  // Token is stored in-memory via Zustand (not localStorage)
  const token =
    typeof window !== "undefined"
      ? (window as any).__AUTH_TOKEN__
      : undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: handle 401 + token refresh ─────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token: string) => {
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${token}`,
            };
            resolve(httpClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is sent via HttpOnly cookie automatically
        const response = await httpClient.post("/auth/refresh");
        const { access_token } = response.data;

        // Store new token in-memory
        if (typeof window !== "undefined") {
          (window as any).__AUTH_TOKEN__ = access_token;
        }

        onRefreshed(access_token);
        isRefreshing = false;

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${access_token}`,
        };
        return httpClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Redirect to login on refresh failure
        if (typeof window !== "undefined") {
          (window as any).__AUTH_TOKEN__ = undefined;
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;

// ─── Generic API Response Types ───────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
