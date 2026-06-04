"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useChartTheme } from "./useChartTheme";

/**
 * Shared theme-aware area chart used by the dashboard + analytics activity
 * panels. Colors come from the resolved CSS variables (light/dark), not
 * hardcoded hex.
 */
export function AreaTrend({
  data,
  xKey = "date",
  yKey = "count",
  height = 224,
}: {
  data: Array<Record<string, unknown>>;
  xKey?: string;
  yKey?: string;
  height?: number;
}) {
  const c = useChartTheme();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 6, top: 4 }}>
          <defs>
            <linearGradient id="areaTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={c.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: c.axis }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => String(v).slice(5)}
          />
          <YAxis tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <Tooltip
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "var(--shadow-lg)",
              color: "var(--fg)",
            }}
            labelStyle={{ color: c.axis }}
            itemStyle={{ color: c.accent }}
          />
          <Area type="monotone" dataKey={yKey} stroke={c.accent} strokeWidth={2} fill="url(#areaTrendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
