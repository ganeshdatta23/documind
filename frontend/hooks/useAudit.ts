/** useAudit — query the tenant audit log. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { auditClient } from "@/lib/api-client";

export function useAuditLogs(params?: {
  page?: number;
  page_size?: number;
  action?: string;
  resource_type?: string;
}) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => auditClient.list(params),
    staleTime: 15_000,
  });
}
