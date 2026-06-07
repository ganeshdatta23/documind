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

/** Pull the backend's error message out of an axios-style error, if present. */
export function getApiErrorMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message;
}

/** True when an error is an AbortController cancellation (not a real failure). */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Document processing states. Display colors live with the components that
 * render status (via the Badge `tone` system), so this keeps just labels + the
 * shared `DocStatus` type.
 */
export const DOC_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  parsing: "Parsing",
  chunking: "Chunking",
  embedding: "Embedding",
  ready: "Ready",
  failed: "Failed",
  archived: "Archived",
};

export type DocStatus = keyof typeof DOC_STATUS_LABELS;
