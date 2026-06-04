"use client";

import { Building2, Users, FileText, HardDrive, ShieldAlert, ScrollText } from "lucide-react";
import { usePlatformStats } from "@/hooks/useAdmin";
import { useAuditLogs } from "@/hooks/useAudit";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggerList, StaggerItem } from "@/components/motion/Stagger";
import { formatBytes, formatRelativeTime } from "@/lib/utils";

function actionTone(action: string) {
  if (action.includes("delete") || action.includes("revoke")) return "danger" as const;
  if (action.includes("login")) return "info" as const;
  if (action.includes("create") || action.includes("upload")) return "success" as const;
  return "neutral" as const;
}

export default function AdminPage() {
  const { user } = useAuth();
  const isSuper = !!user?.is_superadmin;
  const { data: stats, isLoading } = usePlatformStats(isSuper);
  const { data: audit, isLoading: auditLoading } = useAuditLogs({ page_size: 25 });

  if (!isSuper) {
    return (
      <div>
        <PageHeader eyebrow="Platform" title="Admin" subtitle="Platform administration." />
        <div className="mt-8">
          <EmptyState icon={ShieldAlert} title="Superadmin access required" description="You don't have permission to view platform administration." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Platform" title="Admin" subtitle="Platform-wide statistics and the tenant audit trail." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Tenants" value={(stats?.tenants ?? 0).toLocaleString()} icon={Building2} loading={isLoading} />
        <Stat label="Users" value={(stats?.users ?? 0).toLocaleString()} icon={Users} loading={isLoading} />
        <Stat label="Documents" value={(stats?.documents.total ?? 0).toLocaleString()} icon={FileText} loading={isLoading} />
        <Stat label="Storage" value={formatBytes(stats?.storage_bytes ?? 0)} icon={HardDrive} loading={isLoading} />
      </div>

      {stats && stats.documents.failed > 0 && (
        <Card className="border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-warn-subtle">
          <p className="text-sm text-warn">
            {stats.documents.failed} document{stats.documents.failed === 1 ? "" : "s"} failed processing across the platform.
          </p>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex items-center gap-2 border-b border-line px-6 py-4">
          <ScrollText className="h-4 w-4 text-subtle" />
          <h2 className="text-h3 text-fg">Audit log</h2>
        </div>
        {auditLoading ? (
          <div className="divide-y divide-line">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 shimmer" />)}</div>
        ) : audit?.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit events yet" description="Security-relevant actions will appear here." />
        ) : (
          <StaggerList className="divide-y divide-line">
            {audit?.items.map((log) => (
              <StaggerItem key={log.id}>
                <div className="flex items-center gap-4 px-6 py-3 text-sm">
                  <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                  <span className="text-muted">{log.resource_type}</span>
                  <span className="flex-1 truncate text-xs text-subtle">
                    {log.ip_address ?? "—"}{log.actor_id ? ` · actor ${log.actor_id.slice(0, 8)}` : ""}
                  </span>
                  <span className="text-xs text-subtle">{formatRelativeTime(log.created_at)}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </Card>
    </div>
  );
}
