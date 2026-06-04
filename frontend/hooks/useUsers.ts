/** useUsers — tenant member management + own profile. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersClient, usersAdminClient, type UserProfile } from "@/lib/api-client";

const keys = {
  all: ["users"] as const,
  list: (params?: object) => [...keys.all, "list", params] as const,
  me: ["users", "me"] as const,
};

export function useUsers(params?: { page?: number; page_size?: number; is_active?: boolean }) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: () => usersClient.list(params),
    staleTime: 15_000,
  });
}

export function useMyProfile() {
  return useQuery({ queryKey: keys.me, queryFn: () => usersClient.me() });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<UserProfile, "full_name" | "avatar_url">>) =>
      usersClient.updateMe(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      usersClient.changePassword(body),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; full_name: string; roles?: string[] }) =>
      usersClient.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersAdminClient.activate(id) : usersAdminClient.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
