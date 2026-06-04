/** EmptyState — calm placeholder for empty lists/results. */
import type { ElementType, ReactNode } from "react";
import { FadeIn } from "@/components/motion/FadeIn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <FadeIn className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-sunken">
        <Icon className="h-6 w-6 text-subtle" />
      </div>
      <p className="text-h3 text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </FadeIn>
  );
}
