/**
 * useConversations — hooks for conversation and message management.
 * Source: lib/api-client.ts → conversationsClient
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsClient } from "@/lib/api-client";

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (params?: object) =>
    [...conversationKeys.all, "list", params] as const,
  detail: (id: string) => [...conversationKeys.all, "detail", id] as const,
  messages: (id: string) => [...conversationKeys.all, "messages", id] as const,
};

export function useConversations(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: conversationKeys.list(params),
    queryFn: () => conversationsClient.list(params),
    staleTime: 10_000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => conversationsClient.get(id),
    enabled: Boolean(id),
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: () => conversationsClient.messages(conversationId, { limit: 100 }),
    enabled: Boolean(conversationId),
    staleTime: 0,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; document_ids?: string[] }) =>
      conversationsClient.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsClient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
