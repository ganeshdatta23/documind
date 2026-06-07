/**
 * useRAGChat — SSE streaming chat hook.
 * Uses streamChatMessage generator from lib/api.ts.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamChatMessage } from "@/lib/api";
import type { Citation } from "@/lib/api-client";
import { getApiErrorMessage, isAbortError } from "@/lib/utils";
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

  // Reset the transcript when the conversation changes. Done during render (the
  // React-endorsed "adjust state on prop change" pattern) rather than in an
  // effect, so there's no extra commit/cascade. The previously streaming
  // request is aborted in its own cleanup effect below.
  const [activeConvId, setActiveConvId] = useState(conversationId);
  if (conversationId !== activeConvId) {
    setActiveConvId(conversationId);
    setMessages([]);
    setError(null);
    setIsSending(false);
  }

  // Abort any in-flight stream when the conversation changes or on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [conversationId]);

  /** Replace the transcript with persisted history (used on initial load). */
  const hydrate = useCallback((history: StreamingMessage[]) => {
    setMessages(history);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setError(null);
      setIsSending(true);

      // Optimistic user message
      setMessages((prev) => [
        ...prev,
        { role: "user", content, citations: [], isStreaming: false },
        { role: "assistant", content: "", citations: [], isStreaming: true },
      ]);

      try {
        let fullContent = "";
        let finalCitations: Citation[] = [];

        for await (const event of streamChatMessage(
          conversationId,
          content,
          abortRef.current.signal
        )) {
          if (event.event === "token") {
            fullContent += event.data.token ?? "";
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: fullContent,
              };
              return updated;
            });
          } else if (event.event === "done") {
            finalCitations = (event.data.citations as Citation[]) ?? [];
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: (event.data.answer as string) || fullContent,
                citations: finalCitations,
                isStreaming: false,
                latency_ms: event.data.retrieval_latency_ms,
              };
              return updated;
            });
          } else if (event.event === "error") {
            throw new Error((event.data.message as string) || "Stream error");
          }
        }

        qc.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      } catch (err) {
        if (!isAbortError(err)) {
          const msg = getApiErrorMessage(err)
            || (err instanceof Error ? err.message : "Something went wrong");
          setError(msg);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: "Sorry, an error occurred. Please try again.",
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
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        isStreaming: false,
      };
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isSending, error, sendMessage, cancelStream, clearMessages, hydrate };
}
