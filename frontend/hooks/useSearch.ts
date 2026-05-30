/**
 * useSearch — hook for search with debouncing and SSE streaming.
 */
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { searchApi, type ChunkResult, type SearchRequest, type SearchResponse } from "@/lib/api";

export function useSearch() {
  return useMutation({
    mutationFn: (req: SearchRequest) => searchApi.search(req),
  });
}

/** Stream search results via SSE. */
export function useSearchStream() {
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const search = useCallback(
    async (req: SearchRequest) => {
      // Close existing connection
      if (eventSourceRef.current) eventSourceRef.current.close();
      setResults([]);
      setIsStreaming(true);

      // POST body as query param is not clean for SSE; use fetch + ReadableStream
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/search/stream`;
      const token =
        typeof window !== "undefined" ? (window as any).__AUTH_TOKEN__ : "";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(req),
      });

      if (!response.body) { setIsStreaming(false); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const block of lines) {
          if (!block.trim()) continue;
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5).trim());
          const event = eventLine?.slice(6).trim();

          if (event === "result") {
            setResults((prev) => [...prev, data]);
          } else if (event === "done") {
            setLatencyMs(data.latency_ms);
            setIsStreaming(false);
          }
        }
      }
      setIsStreaming(false);
    },
    []
  );

  const reset = useCallback(() => {
    setResults([]);
    setLatencyMs(null);
    setIsStreaming(false);
  }, []);

  return { search, results, isStreaming, latencyMs, reset };
}
