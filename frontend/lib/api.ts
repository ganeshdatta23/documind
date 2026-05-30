/**
 * Manual API methods not generated from OpenAPI:
 *  - File upload with progress
 *  - SSE streaming endpoints
 *  - Auth (cookies + token management)
 *
 * Everything else comes from: lib/generated/client.ts (auto-generated)
 */
import httpClient from "@/lib/http-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Auth (manual — handles token side effects) ───────────────────────────────

export interface LoginPayload { email: string; password: string }
export interface TokenResponse {
  access_token: string; token_type: string;
  expires_in: number; user: AuthUser;
}
export interface AuthUser {
  id: string; email: string; full_name: string;
  tenant_id: string; roles: string[]; is_superadmin: boolean;
}

export const authManualApi = {
  login: (data: LoginPayload) =>
    httpClient.post<TokenResponse>("/auth/login", data).then((r) => r.data),
  logout: () => httpClient.post("/auth/logout").then((r) => r.data),
  refresh: () =>
    httpClient.post<TokenResponse>("/auth/refresh").then((r) => r.data),
};

// ─── File upload with progress (multipart) ────────────────────────────────────

export function uploadDocument(
  formData: FormData,
  onProgress?: (percent: number) => void
) {
  return httpClient
    .post<{ id: string; status: string; title: string }>("/documents", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    })
    .then((r) => r.data);
}

// ─── SSE: Chat streaming ──────────────────────────────────────────────────────

export interface ChatSSEEvent {
  event: "token" | "done" | "error";
  data: {
    token?: string;
    answer?: string;
    citations?: Citation[];
    retrieval_latency_ms?: number;
    message?: string;
  };
}

export interface Citation {
  index: number; chunk_id: string; document_id: string;
  document_title: string; document_filename: string;
  page_number: number | null; excerpt: string;
}

export async function* streamChatMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal
): AsyncGenerator<ChatSSEEvent> {
  const token =
    typeof window !== "undefined" ? (window as any).__DOCUMIND_TOKEN__ : "";

  const res = await fetch(
    `${API_BASE}/api/v1/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(`Chat API error: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;

      yield {
        event: (eventLine?.slice(6).trim() as ChatSSEEvent["event"]) ?? "token",
        data: JSON.parse(dataLine.slice(5).trim()),
      };
    }
  }
}

// ─── SSE: Search streaming ────────────────────────────────────────────────────

export interface SearchSSEResult {
  event: "result" | "done";
  data: unknown;
}

export async function* streamSearch(
  query: string,
  options?: { document_ids?: string[]; top_k?: number },
  signal?: AbortSignal
): AsyncGenerator<SearchSSEResult> {
  const token =
    typeof window !== "undefined" ? (window as any).__DOCUMIND_TOKEN__ : "";

  const res = await fetch(`${API_BASE}/api/v1/search/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, ...options }),
    signal,
  });

  if (!res.ok) throw new Error(`Search API error: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
      if (!dataLine) continue;
      yield {
        event: (eventLine?.slice(6).trim() as SearchSSEResult["event"]) ?? "result",
        data: JSON.parse(dataLine.slice(5).trim()),
      };
    }
  }
}
