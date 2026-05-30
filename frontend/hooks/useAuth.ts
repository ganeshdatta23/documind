"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { authManualApi, type LoginPayload } from "@/lib/api";

export function useAuth() {
  return useAuthStore();
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginPayload) => authManualApi.login(data),
    onSuccess: (response) => {
      setAuth(response.user, response.access_token);
      qc.clear(); // wipe stale queries from previous session
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => authManualApi.logout(),
    onSettled: () => {
      clearAuth();
      qc.clear();
      router.push("/login");
    },
  });
}

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authManualApi.login as any, // replaced by generated hook after codegen
    enabled: false, // use authStore.user instead
    staleTime: Infinity,
  });
}
