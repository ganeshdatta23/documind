"use client";

import { motion } from "framer-motion";
import type { HTMLAttributes } from "react";
import { fadeInUp } from "./tokens";

/** Generic single-element entrance (rise + fade). */
export function FadeIn({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className={className}
      {...(props as object)}
    >
      {children}
    </motion.div>
  );
}
