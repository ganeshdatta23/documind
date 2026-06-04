/** Skeleton — theme-aware shimmer placeholder. */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer rounded-lg", className)} {...props} />;
}
