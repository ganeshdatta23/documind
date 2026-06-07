"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export interface ChartTheme {
  accent: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const FALLBACK: ChartTheme = {
  accent: "#4f46e5",
  grid: "#e9edf2",
  axis: "#64748b",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e9edf2",
};

/**
 * Recharts needs concrete hex values for SVG stops/ticks (it can't reliably take
 * `var(--…)`). This reads the resolved CSS variables off <html> and returns
 * plain hex strings, recomputing whenever the theme flips.
 */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs theme colors read from the DOM after mount/theme change
    setTheme({
      accent: get("--accent", FALLBACK.accent),
      grid: get("--line", FALLBACK.grid),
      axis: get("--subtle", FALLBACK.axis),
      tooltipBg: get("--raised", FALLBACK.tooltipBg),
      tooltipBorder: get("--line", FALLBACK.tooltipBorder),
    });
  }, [resolvedTheme]);

  return theme;
}
