/**
 * useSearch — search hooks using searchClient and SSE stream generator.
 */
"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { searchClient, type ChunkResult, type SearchRequest } from "@/lib/api-client";
import { streamSearch } from "@/lib/api";
import { isAbortError } from "@/lib/utils";

// ─── Standard search mutation ────────────────────────────────────────────────

export function useSearch() {
  return useMutation({
    mutationFn: (req: SearchRequest) => searchClient.search(req),
  });
}

// ─── Streaming search via SSE ────────────────────────────────────────────────

export function useSearchStream() {
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (req: SearchRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setResults([]);
    setIsStreaming(true);
    setLatencyMs(null);

    try {
      for await (const event of streamSearch(req.query, req, abortRef.current.signal)) {
        if (event.event === "result") {
          setResults((prev) => [...prev, event.data as ChunkResult]);
        } else if (event.event === "done") {
          const d = event.data as { latency_ms?: number };
          if (d.latency_ms) setLatencyMs(d.latency_ms);
        }
      }
    } catch (err) {
      if (!isAbortError(err)) console.error("Search stream error:", err);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setLatencyMs(null);
    setIsStreaming(false);
  }, []);

  return { search, results, isStreaming, latencyMs, cancel, reset };
}
