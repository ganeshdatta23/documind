/**
 * lib/api-client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed, hand-written API client for all non-SSE endpoints.
 * Used by React Query hooks directly. This is the STABLE API layer —
 * the auto-generated client (lib/generated/client.ts) augments it after codegen.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { apiRequest, type PaginatedResponse } from "@/lib/http-client";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  roles: string[];
  is_superadmin: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export const authClient = {
  login: (body: LoginPayload) =>
    apiRequest<TokenResponse>({ method: "POST", url: "/auth/login", body }),

  logout: () =>
    apiRequest<void>({ method: "POST", url: "/auth/logout" }),

  refresh: () =>
    apiRequest<TokenResponse>({ method: "POST", url: "/auth/refresh" }),

  me: () =>
    apiRequest<AuthUser>({ method: "GET", url: "/auth/me" }),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size_bytes: number;
  status:
    | "pending"
    | "parsing"
    | "chunking"
    | "embedding"
    | "ready"
    | "failed"
    | "archived";
  tags: string[];
  custom_metadata: Record<string, unknown>;
  page_count: number | null;
  word_count: number | null;
  language: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentListParams {
  page?: number;
  page_size?: number;
  status?: string;
  tags?: string[];
  uploaded_by?: string;
}

export const documentsClient = {
  list: (params?: DocumentListParams) =>
    apiRequest<PaginatedResponse<Document>>({
      method: "GET",
      url: "/documents",
      params: params as Record<string, unknown>,
    }),

  get: (id: string) =>
    apiRequest<Document>({ method: "GET", url: `/documents/${id}` }),

  update: (
    id: string,
    body: Partial<Pick<Document, "title" | "description" | "tags">>
  ) => apiRequest<Document>({ method: "PATCH", url: `/documents/${id}`, body }),

  delete: (id: string) =>
    apiRequest<void>({ method: "DELETE", url: `/documents/${id}` }),
};

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  document_ids: string[];
  message_count: number;
  token_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  index: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_filename: string;
  page_number: number | null;
  excerpt: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  prompt_tokens: number | null;
  completion_tokens: number | null;
  model_name: string | null;
  latency_ms: number | null;
  created_at: string;
}

export const conversationsClient = {
  list: (params?: { page?: number; page_size?: number }) =>
    apiRequest<PaginatedResponse<Conversation>>({
      method: "GET",
      url: "/conversations",
      params: params as Record<string, unknown>,
    }),

  create: (body: { title?: string; document_ids?: string[] }) =>
    apiRequest<Conversation>({ method: "POST", url: "/conversations", body }),

  get: (id: string) =>
    apiRequest<Conversation>({ method: "GET", url: `/conversations/${id}` }),

  delete: (id: string) =>
    apiRequest<void>({ method: "DELETE", url: `/conversations/${id}` }),

  messages: (
    conversationId: string,
    params?: { limit?: number; before_id?: string }
  ) =>
    apiRequest<Message[]>({
      method: "GET",
      url: `/conversations/${conversationId}/messages`,
      params: params as Record<string, unknown>,
    }),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  document_ids?: string[];
  top_k?: number;
  search_mode?: "hybrid" | "vector" | "bm25";
}

export interface ChunkResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_filename: string;
  file_type: string;
  content: string;
  page_number: number | null;
  chunk_index: number;
  vector_score: number;
  bm25_score: number;
  rrf_score: number;
  rerank_score: number | null;
  excerpt: string;
}

export interface SearchResponse {
  query: string;
  results: ChunkResult[];
  total_results: number;
  retrieval_latency_ms: number;
  search_mode: string;
}

export const searchClient = {
  search: (body: SearchRequest) =>
    apiRequest<SearchResponse>({ method: "POST", url: "/search", body }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  roles: Array<{ id: string; name: string; display_name: string }>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const usersClient = {
  me: () => apiRequest<UserProfile>({ method: "GET", url: "/users/me" }),

  updateMe: (body: Partial<Pick<UserProfile, "full_name" | "avatar_url">>) =>
    apiRequest<UserProfile>({ method: "PATCH", url: "/users/me", body }),

  changePassword: (body: {
    current_password: string;
    new_password: string;
  }) => apiRequest<void>({ method: "POST", url: "/users/me/change-password", body }),

  list: (params?: { page?: number; page_size?: number; is_active?: boolean }) =>
    apiRequest<PaginatedResponse<UserProfile>>({
      method: "GET",
      url: "/users",
      params: params as Record<string, unknown>,
    }),

  get: (id: string) =>
    apiRequest<UserProfile>({ method: "GET", url: `/users/${id}` }),

  create: (body: {
    email: string;
    password: string;
    full_name: string;
    roles?: string[];
  }) => apiRequest<UserProfile>({ method: "POST", url: "/users", body }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface OverviewStats {
  documents: {
    total: number;
    ready: number;
    pending: number;
    failed: number;
    processing: number;
  };
  users: { total: number };
  conversations: { this_month: number };
  queries: { today: number };
  storage: { used_bytes: number };
  performance: { avg_response_latency_ms: number | null };
}

export const analyticsClient = {
  overview: () =>
    apiRequest<OverviewStats>({ method: "GET", url: "/analytics/overview" }),

  activity: (days = 30) =>
    apiRequest<{ activity: Array<{ date: string; count: number }>; days: number }>({
      method: "GET",
      url: `/analytics/activity?days=${days}`,
    }),
};

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantUsage {
  tenant_id: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  document_count: number;
  document_limit: number;
  user_count: number;
  user_limit: number;
  api_calls_this_month: number;
  api_call_limit: number;
}

export const tenantClient = {
  me: () => apiRequest<Record<string, unknown>>({ method: "GET", url: "/tenants/me" }),
  usage: () => apiRequest<TenantUsage>({ method: "GET", url: "/tenants/me/usage" }),
};
