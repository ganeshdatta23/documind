"use client";

import {
  FileText,
  MessageSquare,
  Users,
  TrendingUp,
  HardDrive,
  Activity,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { analyticsClient } from "@/lib/api-client";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import { useDocuments } from "@/hooks/useDocuments";
import { useConversations } from "@/hooks/useConversations";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = "sky",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: "sky" | "indigo" | "emerald" | "amber";
}) {
  const colors = {
    sky: "from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-400",
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 text-indigo-400",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
  };
  return (
    <div className={`glass rounded-2xl border p-5 bg-gradient-to-br ${colors[color]} hover:scale-[1.02] transition-transform duration-200`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-current/10`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

// ─── Document Status Badge ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ready: "text-emerald-400 bg-emerald-400/10",
  pending: "text-amber-400 bg-amber-400/10",
  failed: "text-red-400 bg-red-400/10",
  processing: "text-blue-400 bg-blue-400/10",
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Use generated hooks (from codegen) — fallback to manual until generated
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsClient.overview(),
    staleTime: 60_000,
  });

  const { data: activityData } = useQuery({
    queryKey: ["analytics", "activity"],
    queryFn: () => analyticsClient.activity(),
  });

  const { data: docsData, isLoading: docsLoading } = useDocuments({
    page_size: 5,
    status: "ready",
  });

  const { data: convsData } = useConversations({ page_size: 5 });

  return (
    <div className="space-y-8 fade-in">
      {/* ── Header ────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Overview of your workspace activity
        </p>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={overviewLoading ? "—" : (overview?.documents.total ?? 0).toLocaleString()}
          icon={FileText}
          color="sky"
        />
        <StatCard
          label="Queries Today"
          value={overviewLoading ? "—" : (overview?.queries.today ?? 0).toLocaleString()}
          icon={Zap}
          color="indigo"
        />
        <StatCard
          label="Team Members"
          value={overviewLoading ? "—" : (overview?.users.total ?? 0).toLocaleString()}
          icon={Users}
          color="emerald"
        />
        <StatCard
          label="Storage Used"
          value={overviewLoading ? "—" : formatBytes(overview?.storage.used_bytes ?? 0)}
          icon={HardDrive}
          color="amber"
        />
      </div>

      {/* ── Activity Chart + Status ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upload Activity */}
        <div className="xl:col-span-2 glass rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Upload Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Documents uploaded per day</p>
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData?.activity ?? []}>
                <defs>
                  <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#0ea5e9" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#uploadGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Processing Status */}
        <div className="glass rounded-2xl border border-slate-800 p-6">
          <h2 className="text-base font-semibold text-white mb-1">Processing Status</h2>
          <p className="text-xs text-slate-500 mb-6">Document pipeline health</p>
          {overview && (
            <div className="space-y-3">
              {[
                { label: "Ready", value: overview.documents.ready, color: "bg-emerald-400" },
                { label: "Processing", value: overview.documents.processing, color: "bg-blue-400" },
                { label: "Pending", value: overview.documents.pending, color: "bg-amber-400" },
                { label: "Failed", value: overview.documents.failed, color: "bg-red-400" },
              ].map(({ label, value, color }) => {
                const pct = overview.documents.total > 0
                  ? (value / overview.documents.total) * 100
                  : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-300 font-medium">{value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Documents + Conversations ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Docs */}
        <div className="glass rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Recent Documents</h2>
            <a href="/documents" className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {docsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-slate-800/50 animate-pulse" />
                ))
              : docsData?.items.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(doc.file_size_bytes)} · {formatRelativeTime(doc.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[doc.status] ?? STATUS_COLORS.pending
                      }`}
                    >
                      {doc.status}
                    </span>
                  </a>
                ))}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="glass rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Recent Conversations</h2>
            <a href="/chat" className="text-xs text-sky-400 hover:text-sky-300">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {convsData?.items.map((conv) => (
              <a
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                    {conv.title ?? "Untitled conversation"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {conv.message_count} messages ·{" "}
                    {conv.last_message_at
                      ? formatRelativeTime(conv.last_message_at)
                      : "No messages"}
                  </p>
                </div>
              </a>
            ))}
            {!convsData?.items.length && (
              <p className="text-sm text-slate-500 text-center py-6">
                No conversations yet.{" "}
                <a href="/chat" className="text-sky-400 hover:underline">
                  Start one
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
