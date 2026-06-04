/**
 * Input — labelled field with optional icons, hint, and error. Styled via the
 * shared `.field` class (indigo focus halo, danger state) so it's theme-aware.
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-subtle">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "field",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error &&
                "border-danger focus:!border-danger focus:!shadow-[0_0_0_3px_color-mix(in_srgb,var(--danger)_22%,transparent)]",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-subtle">{rightIcon}</div>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
