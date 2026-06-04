/**
 * Shared domain types.
 *
 * The OpenAPI spec is the single source of truth for API shapes: the generator
 * (scripts/generate-api.ts) turns it into lib/generated/schema.ts, and this file
 * aliases those generated interfaces under the friendlier names the app has
 * always used. So there's no second, hand-maintained copy to keep in lockstep —
 * when the backend changes, the types regenerate and `tsc` flags the call sites
 * that need attention.
 *
 * Three kinds of entries live here:
 *   1. Plain aliases — the generated shape is exactly what we want.
 *   2. Aliases with an override — we keep a narrow string union (e.g. document
 *      status, message role) on top of the generated base via `Omit & { … }`.
 *   3. Hand-written — for things the spec doesn't model: query-param shapes and
 *      a couple of endpoints that return un-typed dicts on the backend.
 */
import type * as Schema from "./generated/schema";

// ── Auth ──────────────────────────────────────────────────────────────────
export type LoginPayload = Schema.LoginRequest;
export type AuthUser = Schema.UserInToken;
export type TokenResponse = Schema.TokenResponse;

// ── Documents ───────────────────────────────────────────────────────────────
// The backend types `status` as a free string; we keep the exhaustive union so
// switches and the status UI stay type-checked.
export type DocumentStatus =
  | "pending"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed"
  | "archived";

export type DocumentModel = Omit<Schema.DocumentResponse, "status"> & {
  status: DocumentStatus;
};

// List query params aren't part of any response schema, so they stay hand-written.
export interface DocumentListParams {
  page?: number;
  page_size?: number;
  status?: string;
  tags?: string[];
  uploaded_by?: string;
}

// ── Conversations & messages ─────────────────────────────────────────────────
export type Conversation = Schema.ConversationResponse;
export type Citation = Schema.CitationSchema;

// `role` is a free string in the spec; narrow it to the values we render.
export type Message = Omit<Schema.MessageResponse, "role"> & {
  role: "user" | "assistant" | "system";
};

// ── Search ────────────────────────────────────────────────────────────────
// Request body the search UI builds; we keep the narrow `search_mode` union.
export type SearchRequest = Omit<Schema.SearchRequest, "search_mode"> & {
  search_mode?: "hybrid" | "vector" | "bm25";
};
export type ChunkResult = Schema.ChunkResult;
export type SearchResponse = Schema.SearchResponse;

// ── Users ─────────────────────────────────────────────────────────────────
export type UserProfile = Schema.UserResponse;

// ── Analytics & tenant ──────────────────────────────────────────────────────
// /analytics/overview returns an un-modelled dict on the backend (no
// response_model), so it has no generated counterpart — kept hand-written.
export interface OverviewStats {
  documents: { total: number; ready: number; pending: number; failed: number; processing: number };
  users: { total: number };
  conversations: { this_month: number };
  queries: { today: number };
  storage: { used_bytes: number };
  performance: { avg_response_latency_ms: number | null };
}

export type TenantUsage = Schema.TenantUsageResponse;

// ── API keys ────────────────────────────────────────────────────────────────
export type ApiKey = Schema.APIKeyResponse;
export type ApiKeyCreated = Schema.APIKeyCreatedResponse;

// ── Webhooks ────────────────────────────────────────────────────────────────
export type Webhook = Schema.WebhookResponse;
export type WebhookCreated = Schema.WebhookCreatedResponse;

// Selectable webhook event types (runtime list used by the settings UI).
export const WEBHOOK_EVENTS = [
  "document.uploaded",
  "document.ready",
  "document.failed",
  "document.deleted",
] as const;

// ── Audit & admin ───────────────────────────────────────────────────────────
export type AuditLog = Schema.AuditLogResponse;

// /admin/platform/stats also returns an un-modelled dict — kept hand-written.
export interface PlatformStats {
  tenants: number;
  users: number;
  documents: { total: number; failed: number };
  storage_bytes: number;
}
