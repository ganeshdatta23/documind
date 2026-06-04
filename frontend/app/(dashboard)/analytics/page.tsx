"use client";

import { FileText, MessageSquare, Zap, Clock } from "lucide-react";
import { useOverview, useActivity, useTenantUsage } from "@/hooks/useAnalytics";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { formatBytes, cn } from "@/lib/utils";

function UsageBar({ label, used, limit, fmt }: { label: string; used: number; limit: number; fmt?: (n: number) => string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const danger = pct >= 90;
  const f = fmt ?? ((n: number) => n.toLocaleString());
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("font-medium tabular-nums", danger ? "text-danger" : "text-fg")}>{f(used)} / {f(limit)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: danger ? "var(--danger)" : "var(--accent)" }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useOverview();
  const { data: activity } = useActivity(30);
  const { data: usage } = useTenantUsage();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Insights" title="Analytics" subtitle="Workspace performance over the last 30 days." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Documents" value={(overview?.documents.total ?? 0).toLocaleString()} icon={FileText} loading={isLoading} />
        <Stat label="Queries today" value={(overview?.queries.today ?? 0).toLocaleString()} icon={Zap} loading={isLoading} />
        <Stat label="Conversations (mo)" value={(overview?.conversations.this_month ?? 0).toLocaleString()} icon={MessageSquare} loading={isLoading} />
        <Stat label="Avg retrieval" value={overview?.performance.avg_response_latency_ms != null ? `${Math.round(overview.performance.avg_response_latency_ms)}ms` : "—"} icon={Clock} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-6">
            <h2 className="text-h3 text-fg">Upload activity</h2>
            <p className="mt-0.5 text-xs text-subtle">Documents added per day</p>
          </div>
          <AreaTrend data={activity?.activity ?? []} height={224} />
        </Card>

        <Card>
          <h2 className="text-h3 text-fg">Pipeline</h2>
          <p className="mb-6 mt-0.5 text-xs text-subtle">Document processing health</p>
          {overview && (
            <div className="space-y-4">
              {[
                { label: "Ready", value: overview.documents.ready, color: "var(--success)" },
                { label: "Processing", value: overview.documents.processing, color: "var(--info)" },
                { label: "Pending", value: overview.documents.pending, color: "var(--warn)" },
                { label: "Failed", value: overview.documents.failed, color: "var(--danger)" },
              ].map(({ label, value, color }) => {
                const pct = overview.documents.total > 0 ? (value / overview.documents.total) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">{label}</span>
                      <span className="font-medium tabular-nums text-fg">{value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-sunken">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {usage && (
        <Card>
          <h2 className="text-h3 text-fg">Plan usage</h2>
          <p className="mb-6 mt-0.5 text-xs text-subtle">Consumption against your current limits</p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <UsageBar label="Storage" used={usage.storage_used_bytes} limit={usage.storage_limit_bytes} fmt={formatBytes} />
            <UsageBar label="Documents" used={usage.document_count} limit={usage.document_limit} />
            <UsageBar label="Team members" used={usage.user_count} limit={usage.user_limit} />
            <UsageBar label="API calls (mo)" used={usage.api_calls_this_month} limit={usage.api_call_limit} />
          </div>
        </Card>
      )}
    </div>
  );
}
