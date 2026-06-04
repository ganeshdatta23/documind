"use client";

import Link from "next/link";
import { FileText, MessageSquare, Users, HardDrive, Zap, ArrowUpRight } from "lucide-react";
import { useOverview, useActivity } from "@/hooks/useAnalytics";
import { useDocuments } from "@/hooks/useDocuments";
import { useConversations } from "@/hooks/useConversations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { StaggerList, StaggerItem } from "@/components/motion/Stagger";
import { formatBytes, formatRelativeTime } from "@/lib/utils";

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info" | "neutral"> = {
  ready: "success", pending: "warn", failed: "danger", processing: "info",
};

export default function DashboardPage() {
  const { data: overview, isLoading } = useOverview();
  const { data: activityData } = useActivity(30);
  const { data: docsData, isLoading: docsLoading } = useDocuments({ page_size: 5, status: "ready" });
  const { data: convsData } = useConversations({ page_size: 5 });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" subtitle="A clear look at your workspace today." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Documents" value={(overview?.documents.total ?? 0).toLocaleString()} icon={FileText} loading={isLoading} />
        <Stat label="Queries today" value={(overview?.queries.today ?? 0).toLocaleString()} icon={Zap} loading={isLoading} />
        <Stat label="Team" value={(overview?.users.total ?? 0).toLocaleString()} icon={Users} loading={isLoading} />
        <Stat label="Storage" value={formatBytes(overview?.storage.used_bytes ?? 0)} icon={HardDrive} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-h3 text-fg">Upload activity</h2>
              <p className="mt-0.5 text-xs text-subtle">Documents added over the last 30 days</p>
            </div>
          </div>
          <AreaTrend data={activityData?.activity ?? []} />
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
                    <div className="mb-1.5 flex justify-between text-xs">
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-fg">Recent documents</h2>
            <Link href="/documents" className="flex items-center gap-1 text-xs text-accent hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {docsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : docsData?.items.length ? (
            <StaggerList className="space-y-1">
              {docsData.items.map((doc) => (
                <StaggerItem key={doc.id}>
                  <Link href="/documents" className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-sunken">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-subtle">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{doc.title}</p>
                      <p className="text-xs text-subtle">{formatBytes(doc.file_size_bytes)} · {formatRelativeTime(doc.created_at)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[doc.status] ?? "neutral"} dot>{doc.status}</Badge>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <p className="px-2 py-6 text-sm text-subtle">No documents yet.</p>
          )}
        </Card>

        <Card>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-h3 text-fg">Recent conversations</h2>
            <Link href="/chat" className="flex items-center gap-1 text-xs text-accent hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {convsData?.items.length ? (
            <StaggerList className="space-y-1">
              {convsData.items.map((conv) => (
                <StaggerItem key={conv.id}>
                  <Link href={`/chat/${conv.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-sunken">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-subtle">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{conv.title ?? "Untitled conversation"}</p>
                      <p className="text-xs text-subtle">
                        {conv.message_count} messages · {conv.last_message_at ? formatRelativeTime(conv.last_message_at) : "No messages"}
                      </p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <p className="px-2 py-6 text-sm text-subtle">
              No conversations yet. <Link href="/chat" className="text-accent hover:underline">Start one →</Link>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
