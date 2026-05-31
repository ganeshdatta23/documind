// AUTO-GENERATED placeholder — do not edit manually
// Run `npm run generate-api` with the backend running to populate this file.

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/generated/client";
import type * as Schema from "@/lib/generated/schema";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
} as const;

/** Get current authenticated user */
export function useAuthMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => api.authMe(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Sign in with email and password */
export function useAuthLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.authLogin,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/** Sign out */
export function useAuthLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.authLogout,
    onSettled: () => {
      qc.clear();
    },
  });
}

/** Refresh access token */
export function useAuthRefresh() {
  return useMutation({
    mutationFn: api.authRefresh,
  });
}
