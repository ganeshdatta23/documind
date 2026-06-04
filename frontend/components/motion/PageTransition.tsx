"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { fadeInUp } from "./tokens";

/**
 * Mount animation for dashboard route content. Re-keys on pathname so each
 * navigation replays a subtle rise/fade. (No exit animation — App Router
 * unmounts the subtree on navigation; a clean mount is the conventional,
 * robust choice.)
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div key={pathname} variants={fadeInUp} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
