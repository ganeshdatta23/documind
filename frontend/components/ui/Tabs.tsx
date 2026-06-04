"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Accessible tab bar with a sliding accent underline. Controlled. Roving focus
 * with Left/Right/Home/End keys; proper tablist/tab roles + aria-selected.
 */
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const last = tabs.length - 1;
    let next = idx;
    if (e.key === "ArrowRight") next = idx < last ? idx + 1 : 0;
    else if (e.key === "ArrowLeft") next = idx > 0 ? idx - 1 : last;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-subtle hover:text-muted"
            )}
          >
            {t.icon}
            {t.label}
            {active && (
              <motion.span
                layoutId="tabs-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
