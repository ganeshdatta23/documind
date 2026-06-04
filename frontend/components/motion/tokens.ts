/**
 * Shared motion tokens + variants. One source of truth so every animation in
 * the app uses the same timing/easing and reads as a deliberate system rather
 * than ad-hoc tweaks. ~200ms, confident, no bounce (matches the Stripe/Notion
 * feel). All consumers run inside <MotionConfig reducedMotion="user"> so these
 * collapse to opacity-only when the user prefers reduced motion.
 */
import type { Variants, Transition } from "framer-motion";

export const DURATION = { fast: 0.12, base: 0.2, slow: 0.32 } as const;

// Crisp ease-out — the workhorse curve.
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const TRANSITION: Transition = { duration: DURATION.base, ease: EASE_OUT };

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: TRANSITION },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: TRANSITION },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

// Right-edge slide-over (citation panel).
export const panelRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: TRANSITION },
  exit: { opacity: 0, x: 24, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};

// Popover/menu pop.
export const scalePop: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: DURATION.fast, ease: EASE_OUT } },
};
