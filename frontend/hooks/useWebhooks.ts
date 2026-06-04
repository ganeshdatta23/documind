/** useWebhooks — manage outbound webhook subscriptions. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webhooksClient, type Webhook } from "@/lib/api-client";

const keys = { all: ["webhooks"] as const };

export function useWebhooks() {
  return useQuery({ queryKey: keys.all, queryFn: () => webhooksClient.list() });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; url: string; events: string[] }) =>
      webhooksClient.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Webhook, "name" | "url" | "events" | "is_active">> }) =>
      webhooksClient.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhooksClient.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
