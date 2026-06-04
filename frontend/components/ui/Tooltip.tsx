"use client";

import { useState, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight tooltip (no Radix). Shows on hover/focus after a short delay.
 * `side` positions the bubble. For icon-only buttons and collapsed nav labels.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { timer.current = setTimeout(() => setOpen(true), 120); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };

  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "panel pointer-events-none absolute z-50 whitespace-nowrap px-2 py-1 text-[11px] font-medium text-fg",
              pos
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
