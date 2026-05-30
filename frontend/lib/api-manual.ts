// Manually curated helper re-exporting analytics helpers
// (used until `npm run generate-api` is run against a live backend)
import httpClient from "@/lib/http-client";

export const analyticsApi = {
  overview: () => httpClient.get("/analytics/overview").then((r) => r.data),
  activity: (days = 30) =>
    httpClient
      .get(`/analytics/activity?days=${days}`)
      .then((r) => r.data as { activity: Array<{ date: string; count: number }>; days: number }),
};
