"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Segmented control (radiogroup) with a sliding highlight behind the active
 * segment. Arrow-key selectable. Used for the search-mode switcher.
 */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: SegmentDef[];
  value: T;
  onChange: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const last = segments.length - 1;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = idx < last ? idx + 1 : 0;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = idx > 0 ? idx - 1 : last;
    else return;
    e.preventDefault();
    onChange(segments[next].id as T);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" className="inline-flex gap-1 rounded-lg border border-line bg-sunken p-1">
      {segments.map((s, i) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            ref={(el) => { refs.current[i] = el; }}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(s.id as T)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "text-fg" : "text-subtle hover:text-muted"
            )}
          >
            {active && (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 rounded-md bg-surface shadow-[var(--shadow-xs)]"
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {s.icon}
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
