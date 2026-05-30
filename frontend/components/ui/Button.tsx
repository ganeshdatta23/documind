/**
 * Button — ultra-premium button component with multiple variants.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-xl " +
      "transition-all duration-200 focus:outline-none focus-visible:ring-2 " +
      "focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 " +
      "disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variants = {
      primary:
        "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg " +
        "hover:from-sky-400 hover:to-indigo-400 hover:shadow-sky-500/25 hover:shadow-xl " +
        "active:scale-[0.98]",
      secondary:
        "bg-slate-800 text-slate-200 border border-slate-700 " +
        "hover:bg-slate-700 hover:border-slate-600 active:scale-[0.98]",
      ghost:
        "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 active:scale-[0.98]",
      danger:
        "bg-red-500/10 text-red-400 border border-red-500/20 " +
        "hover:bg-red-500/20 hover:border-red-500/40 active:scale-[0.98]",
      outline:
        "border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 " +
        "hover:border-sky-500/60 active:scale-[0.98]",
    };

    const sizes = {
      xs: "text-xs px-2.5 py-1.5 rounded-lg",
      sm: "text-sm px-3.5 py-2",
      md: "text-sm px-4 py-2.5",
      lg: "text-base px-6 py-3",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
