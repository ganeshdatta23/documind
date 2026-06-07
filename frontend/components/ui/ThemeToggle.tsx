"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. Gated on `mounted` so the server (which can't know the
 * resolved theme) doesn't cause a hydration mismatch — renders a neutral
 * placeholder until then.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag to avoid an SSR hydration mismatch
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-fg"
    >
      {!mounted ? (
        <span className="h-[18px] w-[18px]" />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </motion.span>
        </AnimatePresence>
      )}
    </button>
  );
}
