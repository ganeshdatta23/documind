/**
 * Typed REST client for every non-streaming endpoint.
 *
 * This is the stable, hand-written surface the hooks call. Domain types live in
 * lib/types.ts; we re-export the common ones here so existing
 * `import { ... } from "@/lib/api-client"` call sites keep working. SSE
 * endpoints (chat/search streaming) live in lib/api.ts instead.
 */
import { apiRequest, type PaginatedResponse } from "@/lib/http-client";
import type {
  ApiKey,
  ApiKeyCreated,
  AuditLog,
  AuthUser,
  Conversation,
  DocumentListParams,
  DocumentModel,
  LoginPayload,
  Message,
  OverviewStats,
  PlatformStats,
  SearchRequest,
  SearchResponse,
  TenantUsage,
  TokenResponse,
  UserProfile,
  Webhook,
  WebhookCreated,
} from "./types";

// Re-export the domain types from a single import surface.
export type {
  ApiKey,
  ApiKeyCreated,
  AuditLog,
  AuthUser,
  ChunkResult,
  Conversation,
  DocumentListParams,
  LoginPayload,
  Message,
  OverviewStats,
  PlatformStats,
  SearchRequest,
  SearchResponse,
  TenantUsage,
  TokenResponse,
  UserProfile,
  Webhook,
  WebhookCreated,
} from "./types";
export type { Citation } from "./types";
// Historic alias: callers import `Document` (the DOM type is never used here).
export type { DocumentModel as Document } from "./types";
export { WEBHOOK_EVENTS } from "./types";

// ── Auth ──────────────────────────────────────────────────────────────────
export const authClient = {
  login: (body: LoginPayload) =>
    apiRequest<TokenResponse>({ method: "POST", url: "/auth/login", body }),
  logout: () => apiRequest<void>({ method: "POST", url: "/auth/logout" }),
  refresh: () => apiRequest<TokenResponse>({ method: "POST", url: "/auth/refresh" }),
  me: () => apiRequest<AuthUser>({ method: "GET", url: "/auth/me" }),
};

// ── Documents ───────────────────────────────────────────────────────────────
export const documentsClient = {
  list: (params?: DocumentListParams) =>
    apiRequest<PaginatedResponse<DocumentModel>>({
      method: "GET",
      url: "/documents",
      params: params as Record<string, unknown>,
    }),
  get: (id: string) => apiRequest<DocumentModel>({ method: "GET", url: `/documents/${id}` }),
  update: (id: string, body: Partial<Pick<DocumentModel, "title" | "description" | "tags">>) =>
    apiRequest<DocumentModel>({ method: "PATCH", url: `/documents/${id}`, body }),
  delete: (id: string) => apiRequest<void>({ method: "DELETE", url: `/documents/${id}` }),
};

// ── Conversations ─────────────────────────────────────────────────────────
export const conversationsClient = {
  list: (params?: { page?: number; page_size?: number }) =>
    apiRequest<PaginatedResponse<Conversation>>({
      method: "GET",
      url: "/conversations",
      params: params as Record<string, unknown>,
    }),
  create: (body: { title?: string; document_ids?: string[] }) =>
    apiRequest<Conversation>({ method: "POST", url: "/conversations", body }),
  get: (id: string) => apiRequest<Conversation>({ method: "GET", url: `/conversations/${id}` }),
  delete: (id: string) => apiRequest<void>({ method: "DELETE", url: `/conversations/${id}` }),
  messages: (conversationId: string, params?: { limit?: number; before_id?: string }) =>
    apiRequest<Message[]>({
      method: "GET",
      url: `/conversations/${conversationId}/messages`,
      params: params as Record<string, unknown>,
    }),
};

// ── Search ────────────────────────────────────────────────────────────────
export const searchClient = {
  search: (body: SearchRequest) =>
    apiRequest<SearchResponse>({ method: "POST", url: "/search", body }),
};

// ── Users ─────────────────────────────────────────────────────────────────
export const usersClient = {
  me: () => apiRequest<UserProfile>({ method: "GET", url: "/users/me" }),
  updateMe: (body: Partial<Pick<UserProfile, "full_name" | "avatar_url">>) =>
    apiRequest<UserProfile>({ method: "PATCH", url: "/users/me", body }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    apiRequest<void>({ method: "POST", url: "/users/me/change-password", body }),
  list: (params?: { page?: number; page_size?: number; is_active?: boolean }) =>
    apiRequest<PaginatedResponse<UserProfile>>({
      method: "GET",
      url: "/users",
      params: params as Record<string, unknown>,
    }),
  get: (id: string) => apiRequest<UserProfile>({ method: "GET", url: `/users/${id}` }),
  create: (body: { email: string; password: string; full_name: string; roles?: string[] }) =>
    apiRequest<UserProfile>({ method: "POST", url: "/users", body }),
};

export const usersAdminClient = {
  deactivate: (id: string) => apiRequest<void>({ method: "POST", url: `/users/${id}/deactivate` }),
  activate: (id: string) => apiRequest<void>({ method: "POST", url: `/users/${id}/activate` }),
  setRoles: (id: string, roles: string[]) =>
    apiRequest<UserProfile>({ method: "PUT", url: `/users/${id}/roles`, body: { roles } }),
};

// ── Analytics & tenant ──────────────────────────────────────────────────────
export const analyticsClient = {
  overview: () => apiRequest<OverviewStats>({ method: "GET", url: "/analytics/overview" }),
  activity: (days = 30) =>
    apiRequest<{ activity: Array<{ date: string; count: number }>; days: number }>({
      method: "GET",
      url: `/analytics/activity?days=${days}`,
    }),
};

export const tenantClient = {
  me: () => apiRequest<Record<string, unknown>>({ method: "GET", url: "/tenants/me" }),
  usage: () => apiRequest<TenantUsage>({ method: "GET", url: "/tenants/me/usage" }),
};

// ── API keys ────────────────────────────────────────────────────────────────
export const apiKeysClient = {
  list: () => apiRequest<{ items: ApiKey[]; total: number }>({ method: "GET", url: "/api-keys" }),
  create: (body: { name: string; scopes?: string[]; expires_in_days?: number }) =>
    apiRequest<ApiKeyCreated>({ method: "POST", url: "/api-keys", body }),
  revoke: (id: string) => apiRequest<void>({ method: "DELETE", url: `/api-keys/${id}` }),
};

// ── Webhooks ────────────────────────────────────────────────────────────────
export const webhooksClient = {
  list: () => apiRequest<{ items: Webhook[]; total: number }>({ method: "GET", url: "/webhooks" }),
  create: (body: { name: string; url: string; events: string[] }) =>
    apiRequest<WebhookCreated>({ method: "POST", url: "/webhooks", body }),
  update: (id: string, body: Partial<Pick<Webhook, "name" | "url" | "events" | "is_active">>) =>
    apiRequest<Webhook>({ method: "PATCH", url: `/webhooks/${id}`, body }),
  delete: (id: string) => apiRequest<void>({ method: "DELETE", url: `/webhooks/${id}` }),
};

// ── Audit & admin ───────────────────────────────────────────────────────────
export const auditClient = {
  list: (params?: { page?: number; page_size?: number; action?: string; resource_type?: string }) =>
    apiRequest<PaginatedResponse<AuditLog>>({
      method: "GET",
      url: "/audit",
      params: params as Record<string, unknown>,
    }),
};

export const adminClient = {
  platformStats: () => apiRequest<PlatformStats>({ method: "GET", url: "/admin/platform/stats" }),
};
