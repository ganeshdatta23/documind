/**
 * Card — the surface primitive. White (light) / raised-neutral (dark) panel with
 * a visible layered shadow and hairline border. `interactive` adds a hover lift.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, padded = true, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("surface", interactive && "surface-interactive cursor-pointer", padded && "p-6", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";
