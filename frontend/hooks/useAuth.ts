/**
 * useAuth — authentication hooks backed by Zustand + React Query.
 * Source: lib/api-client.ts → authClient
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { authClient, type LoginPayload } from "@/lib/api-client";

// ─── Store accessor ──────────────────────────────────────────────────────────

export function useAuth() {
  return useAuthStore();
}

// ─── Me query ────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authClient.me(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ─── Login ───────────────────────────────────────────────────────────────────

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginPayload) => authClient.login(data),
    onSuccess: (response) => {
      // Store token in memory for HTTP client
      if (typeof window !== "undefined") {
        (window as any).__DOCUMIND_TOKEN__ = response.access_token;
      }
      setAuth(response.user, response.access_token);
      qc.clear();
      router.push("/dashboard");
    },
  });
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => authClient.logout(),
    onSettled: () => {
      if (typeof window !== "undefined") {
        (window as any).__DOCUMIND_TOKEN__ = undefined;
      }
      clearAuth();
      qc.clear();
      router.push("/login");
    },
  });
}
