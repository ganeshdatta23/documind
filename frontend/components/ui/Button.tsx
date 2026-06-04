/**
 * Button — indigo-accent primary, surface secondary, quiet ghost, soft danger.
 * Styling lives in globals.css (.btn + .btn-*); press feedback via active scale.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
}

const VARIANT = {
  primary: "btn-primary",
  accent: "btn-primary", // alias — single accent system
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE = {
  xs: "text-xs px-2.5 py-1.5",
  sm: "text-sm px-3.5 py-2",
  md: "text-sm px-4 py-2.5",
  lg: "text-[15px] px-5 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading = false, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        "btn transition-transform active:scale-[0.98]",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {isLoading && (
        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);

Button.displayName = "Button";
