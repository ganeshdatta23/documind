// AUTO-GENERATED placeholder — do not edit manually
// Run `npm run generate-api` with the backend running to replace this file.
// Populated automatically before every `npm run dev` / `npm run build`.

import type * as Schema from "./schema";
import { apiRequest } from "../http-client";

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Sign in with email and password */
export async function authLogin(body: { email: string; password: string }): Promise<Schema.TokenResponse> {
  return apiRequest<Schema.TokenResponse>({ method: "POST", url: "/auth/login", body });
}

/** Refresh access token using HttpOnly cookie */
export async function authRefresh(): Promise<Schema.TokenResponse> {
  return apiRequest<Schema.TokenResponse>({ method: "POST", url: "/auth/refresh" });
}

/** Sign out current session */
export async function authLogout(): Promise<void> {
  return apiRequest<void>({ method: "POST", url: "/auth/logout" });
}

/** Get current authenticated user */
export async function authMe(): Promise<Schema.User> {
  return apiRequest<Schema.User>({ method: "GET", url: "/auth/me" });
}

// ── Documents ────────────────────────────────────────────────────────────────

/** List documents with optional filters */
export async function documentsList(query?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<Schema.PaginatedResponse<Schema.Document>> {
  return apiRequest({ method: "GET", url: "/documents", params: query as Record<string, unknown> });
}

/** Get a document by ID */
export async function documentsGet(pathParams: { id: string }): Promise<Schema.Document> {
  return apiRequest<Schema.Document>({ method: "GET", url: `/documents/${pathParams.id}` });
}

/** Update document metadata */
export async function documentsUpdate(
  pathParams: { id: string },
  body: Partial<Pick<Schema.Document, "title" | "description" | "tags">>
): Promise<Schema.Document> {
  return apiRequest<Schema.Document>({ method: "PATCH", url: `/documents/${pathParams.id}`, body });
}

/** Delete a document */
export async function documentsDelete(pathParams: { id: string }): Promise<void> {
  return apiRequest<void>({ method: "DELETE", url: `/documents/${pathParams.id}` });
}

// ── Conversations ─────────────────────────────────────────────────────────────

/** List conversations */
export async function conversationsList(query?: {
  page?: number;
  page_size?: number;
}): Promise<Schema.PaginatedResponse<Schema.Conversation>> {
  return apiRequest({ method: "GET", url: "/conversations", params: query as Record<string, unknown> });
}

/** Create a new conversation */
export async function conversationsCreate(body: {
  title?: string;
  document_ids?: string[];
}): Promise<Schema.Conversation> {
  return apiRequest<Schema.Conversation>({ method: "POST", url: "/conversations", body });
}

/** Get a conversation by ID */
export async function conversationsGet(pathParams: { id: string }): Promise<Schema.Conversation> {
  return apiRequest<Schema.Conversation>({ method: "GET", url: `/conversations/${pathParams.id}` });
}

/** Delete a conversation */
export async function conversationsDelete(pathParams: { id: string }): Promise<void> {
  return apiRequest<void>({ method: "DELETE", url: `/conversations/${pathParams.id}` });
}

/** Get messages in a conversation */
export async function conversationsMessages(
  pathParams: { id: string },
  query?: { limit?: number }
): Promise<Schema.Message[]> {
  return apiRequest<Schema.Message[]>({
    method: "GET",
    url: `/conversations/${pathParams.id}/messages`,
    params: query as Record<string, unknown>,
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

/** Hybrid semantic + keyword search */
export async function searchQuery(body: {
  query: string;
  document_ids?: string[];
  top_k?: number;
  search_mode?: "hybrid" | "vector" | "bm25";
}): Promise<Schema.SearchResponse> {
  return apiRequest<Schema.SearchResponse>({ method: "POST", url: "/search", body });
}

// ── Users ─────────────────────────────────────────────────────────────────────

/** Get current user's profile */
export async function usersMe(): Promise<Schema.User> {
  return apiRequest<Schema.User>({ method: "GET", url: "/users/me" });
}

/** Update current user's profile */
export async function usersMeUpdate(body: { full_name?: string; avatar_url?: string | null }): Promise<Schema.User> {
  return apiRequest<Schema.User>({ method: "PATCH", url: "/users/me", body });
}

/** List users in tenant */
export async function usersList(query?: {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}): Promise<Schema.PaginatedResponse<Schema.User>> {
  return apiRequest({ method: "GET", url: "/users", params: query as Record<string, unknown> });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/** Dashboard overview metrics */
export async function analyticsOverview(): Promise<Schema.OverviewStats> {
  return apiRequest<Schema.OverviewStats>({ method: "GET", url: "/analytics/overview" });
}

/** Document upload activity (last N days) */
export async function analyticsActivity(query?: {
  days?: number;
}): Promise<{ activity: Array<{ date: string; count: number }>; days: number }> {
  return apiRequest({ method: "GET", url: "/analytics/activity", params: query as Record<string, unknown> });
}

// ── Tenants ───────────────────────────────────────────────────────────────────

/** Get current tenant info */
export async function tenantsMe(): Promise<Schema.Tenant> {
  return apiRequest<Schema.Tenant>({ method: "GET", url: "/tenants/me" });
}

/** Get current tenant usage */
export async function tenantsMeUsage(): Promise<Schema.TenantUsage> {
  return apiRequest<Schema.TenantUsage>({ method: "GET", url: "/tenants/me/usage" });
}
