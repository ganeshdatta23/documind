"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { scalePop } from "@/components/motion/tokens";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
}

/**
 * Accessible dropdown menu (hand-rolled — no Radix). Trigger + popover panel.
 * Closes on outside-click, Escape, and select; arrow-key navigation between
 * items; focus moves into the menu on open and returns to the trigger on close.
 */
export function DropdownMenu({
  trigger,
  header,
  items,
  align = "right",
}: {
  trigger: ReactNode;
  header?: ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    // focus first item
    requestAnimationFrame(() => itemRefs.current[0]?.focus());
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const last = items.length - 1;
    const active = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); itemRefs.current[active < last ? active + 1 : 0]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); itemRefs.current[active > 0 ? active - 1 : last]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); itemRefs.current[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); itemRefs.current[last]?.focus(); }
  };

  const itemClass = (danger?: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
      danger
        ? "text-danger hover:bg-danger-subtle"
        : "text-muted hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-fg"
    );

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            variants={scalePop}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={cn("panel absolute top-12 z-50 w-56 p-1.5", align === "right" ? "right-0" : "left-0")}
          >
            {header && <div className="border-b border-line px-3 py-2.5">{header}</div>}
            <div className="mt-1 space-y-0.5">
              {items.map((item, i) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    role="menuitem"
                    ref={(el) => { itemRefs.current[i] = el; }}
                    onClick={() => close(false)}
                    className={itemClass(item.danger)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    ref={(el) => { itemRefs.current[i] = el; }}
                    onClick={() => { close(false); item.onSelect?.(); }}
                    className={itemClass(item.danger)}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
