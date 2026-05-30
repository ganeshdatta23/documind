/**
 * useConversations — hooks for conversation and message management.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "@/lib/api";

export const conversationKeys = {
  all: ["conversations"] as const,
  list: (params?: object) => [...conversationKeys.all, "list", params] as const,
  detail: (id: string) => [...conversationKeys.all, "detail", id] as const,
  messages: (id: string) => [...conversationKeys.all, "messages", id] as const,
};

export function useConversations(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: conversationKeys.list(params),
    queryFn: () => conversationsApi.list(params),
    staleTime: 10_000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => conversationsApi.get(id),
    enabled: !!id,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: () => conversationsApi.messages(conversationId, { limit: 100 }),
    enabled: !!conversationId,
    staleTime: 0,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; document_ids?: string[] }) =>
      conversationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
