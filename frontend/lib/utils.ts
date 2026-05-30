/**
 * cn — className utility combining clsx + tailwind-merge.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format bytes to human-readable size string. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Format a date string to a relative time string. */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Truncate text to maxLength with ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/** Document status display config. */
export const DOC_STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-400/10", dot: "bg-amber-400" },
  parsing: { label: "Parsing", color: "text-blue-400", bg: "bg-blue-400/10", dot: "bg-blue-400" },
  chunking: { label: "Chunking", color: "text-blue-400", bg: "bg-blue-400/10", dot: "bg-blue-400" },
  embedding: { label: "Embedding", color: "text-purple-400", bg: "bg-purple-400/10", dot: "bg-purple-400" },
  ready: { label: "Ready", color: "text-emerald-400", bg: "bg-emerald-400/10", dot: "bg-emerald-400" },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400/10", dot: "bg-red-400" },
  archived: { label: "Archived", color: "text-gray-400", bg: "bg-gray-400/10", dot: "bg-gray-400" },
} as const;

export type DocStatus = keyof typeof DOC_STATUS_CONFIG;
