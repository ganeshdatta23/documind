/** useApiKeys — manage programmatic API keys. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeysClient } from "@/lib/api-client";

const keys = { all: ["api-keys"] as const };

export function useApiKeys() {
  return useQuery({ queryKey: keys.all, queryFn: () => apiKeysClient.list() });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes?: string[]; expires_in_days?: number }) =>
      apiKeysClient.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeysClient.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
