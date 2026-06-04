/**
 * Badge — compact status pill: tinted background + matching text, optional dot.
 * New tone names are accent/success/warn/danger/info/neutral; the old
 * spark/ok/err names are kept as aliases so existing callers don't break.
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral" | "accent" | "success" | "warn" | "danger" | "info"
  | "spark" | "ok" | "err"; // legacy aliases

const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-line",
  accent: "bg-accent-subtle text-accent border-[color-mix(in_srgb,var(--accent)_25%,transparent)]",
  success: "bg-success-subtle text-success border-[color-mix(in_srgb,var(--success)_25%,transparent)]",
  warn: "bg-warn-subtle text-warn border-[color-mix(in_srgb,var(--warn)_25%,transparent)]",
  danger: "bg-danger-subtle text-danger border-[color-mix(in_srgb,var(--danger)_25%,transparent)]",
  info: "bg-info-subtle text-info border-[color-mix(in_srgb,var(--info)_25%,transparent)]",
  // aliases
  spark: "bg-accent-subtle text-accent border-[color-mix(in_srgb,var(--accent)_25%,transparent)]",
  ok: "bg-success-subtle text-success border-[color-mix(in_srgb,var(--success)_25%,transparent)]",
  err: "bg-danger-subtle text-danger border-[color-mix(in_srgb,var(--danger)_25%,transparent)]",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-subtle",
  accent: "bg-accent", success: "bg-success", warn: "bg-warn", danger: "bg-danger", info: "bg-info",
  spark: "bg-accent", ok: "bg-success", err: "bg-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({ tone = "neutral", dot = false, pulse = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone], pulse && "pulse-dot")} />}
      {children}
    </span>
  );
}
