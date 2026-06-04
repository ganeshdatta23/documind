/** useAnalytics — dashboard metrics, activity series, and tenant usage. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsClient, tenantClient } from "@/lib/api-client";

export function useOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsClient.overview(),
    staleTime: 60_000,
  });
}

export function useActivity(days = 30) {
  return useQuery({
    queryKey: ["analytics", "activity", days],
    queryFn: () => analyticsClient.activity(days),
    staleTime: 60_000,
  });
}

export function useTenantUsage() {
  return useQuery({
    queryKey: ["tenant", "usage"],
    queryFn: () => tenantClient.usage(),
    staleTime: 60_000,
  });
}
