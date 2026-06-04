/** useAdmin — platform-wide stats (superadmin only). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { adminClient } from "@/lib/api-client";

export function usePlatformStats(enabled = true) {
  return useQuery({
    queryKey: ["admin", "platform-stats"],
    queryFn: () => adminClient.platformStats(),
    staleTime: 60_000,
    enabled,
    retry: false,
  });
}
