/**
 * lib/api.ts — SSE Streaming + File Upload
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses API_BASE_URL and getToken() from http-client — NO hardcoded paths.
 * Fetch is used (not Axios) because ReadableStream requires native fetch.
 * The base URL is the same as httpClient so routing stays consistent.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import httpClient, { API_BASE_URL, getToken } from "@/lib/http-client";

// ─── File Upload (multipart, with progress) ───────────────────────────────────

export function uploadDocument(
  formData: FormData,
  onProgress?: (percent: number) => void
) {
  return httpClient
    .post<{ id: string; status: string; title: string }>(
      "/documents",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      }
    )
    .then((r) => r.data);
}

// ─── SSE helper ────────────────────────────────────────────────────────────────
// Streams response body as Server-Sent Events and yields typed event objects.
// Uses API_BASE_URL from http-client — no hardcoded /api/v1 paths.

async function* readSSEStream<T extends { event: string; data: unknown }>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err?.error?.message ?? message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
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

        let parsed: unknown;
        try {
          parsed = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue; // skip malformed frames
        }

        yield {
          event: eventLine?.slice(6).trim() ?? "message",
          data: parsed,
        } as T;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Chat streaming ───────────────────────────────────────────────────────────

export interface ChatSSEEvent {
  event: "token" | "done" | "error";
  data: {
    token?: string;
    answer?: string;
    citations?: unknown[];
    retrieval_latency_ms?: number;
    message?: string;
  };
}

export function streamChatMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal
): AsyncGenerator<ChatSSEEvent> {
  return readSSEStream<ChatSSEEvent>(
    `/conversations/${conversationId}/messages`,
    { content },
    signal
  );
}

// ─── Search streaming ─────────────────────────────────────────────────────────

export interface SearchSSEEvent {
  event: "result" | "done" | "error";
  data: unknown;
}

export function streamSearch(
  query: string,
  options?: { document_ids?: string[]; top_k?: number },
  signal?: AbortSignal
): AsyncGenerator<SearchSSEEvent> {
  return readSSEStream<SearchSSEEvent>(
    "/search/stream",
    { query, ...options },
    signal
  );
}
