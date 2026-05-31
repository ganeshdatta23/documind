// AUTO-GENERATED placeholder — do not edit manually
// Run `npm run generate-api` with the backend running to populate this file.
// Or it is generated automatically before every `npm run dev` / `npm run build`.

/** Generic paginated response shape */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Common domain types (populated by generate-api from live OpenAPI spec) ──

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  status: "active" | "suspended" | "deleted";
  max_storage_bytes: number;
  max_documents: number;
  max_users: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
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
  status: "pending" | "parsing" | "chunking" | "embedding" | "ready" | "failed" | "archived";
  tags: string[];
  custom_metadata: Record<string, unknown>;
  page_count: number | null;
  word_count: number | null;
  language: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

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

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    full_name: string;
    tenant_id: string;
    roles: string[];
    is_superadmin: boolean;
  };
}

export interface OverviewStats {
  documents: { total: number; ready: number; pending: number; failed: number; processing: number };
  users: { total: number };
  conversations: { this_month: number };
  queries: { today: number };
  storage: { used_bytes: number };
  performance: { avg_response_latency_ms: number | null };
}

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

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  status: string;
  created_at: string;
}
