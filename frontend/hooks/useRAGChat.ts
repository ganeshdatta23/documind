/**
 * useRAGChat — SSE streaming chat hook for RAG conversations.
 * Streams tokens from the backend, accumulates the response, and persists messages.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Citation, Message } from "@/lib/api";
import { conversationKeys } from "./useConversations";

export interface StreamingMessage {
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  isStreaming: boolean;
  latency_ms?: number;
}

export function useRAGChat(conversationId: string) {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setError(null);
      setIsSending(true);

      // Optimistically add user message
      const userMsg: StreamingMessage = {
        role: "user", content, citations: [], isStreaming: false,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Placeholder for streaming assistant message
      const assistantMsg: StreamingMessage = {
        role: "assistant", content: "", citations: [], isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/conversations/${conversationId}/messages`;
        const token = typeof window !== "undefined" ? (window as any).__AUTH_TOKEN__ : "";

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let finalCitations: Citation[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
            const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
            if (!dataLine) continue;

            const event = eventLine?.slice(6).trim();
            const data = JSON.parse(dataLine.slice(5).trim());

            if (event === "token") {
              fullContent += data.token;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: fullContent,
                };
                return updated;
              });
            } else if (event === "done") {
              finalCitations = data.citations ?? [];
              const latency = data.retrieval_latency_ms;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: data.answer || fullContent,
                  citations: finalCitations,
                  isStreaming: false,
                  latency_ms: latency,
                };
                return updated;
              });
            }
          }
        }

        // Invalidate messages query to sync with backend
        qc.invalidateQueries({
          queryKey: conversationKeys.messages(conversationId),
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong");
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: "Sorry, something went wrong. Please try again.",
              isStreaming: false,
            };
            return updated;
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, isSending, qc]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsSending(false);
    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false,
        };
      }
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isSending, error, sendMessage, cancelStream, clearMessages };
}
