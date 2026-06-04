"use client";

import { motion } from "framer-motion";
import type { HTMLAttributes } from "react";
import { staggerContainer, staggerItem } from "./tokens";

/**
 * StaggerList + StaggerItem — children animate in sequence. Used for result
 * lists, tables, and feeds. Replaces the old CSS `.stagger`/`--i` hack.
 */
export function StaggerList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
      {...(props as object)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div variants={staggerItem} className={className} {...(props as object)}>
      {children}
    </motion.div>
  );
}
