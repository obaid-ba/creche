import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  // Only reference ids that actually render, or screen readers announce
  // "undefined" for the missing element.
  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-semibold text-ink-700"
      >
        {label}
      </label>

      <div className="relative">
        {leftIcon !== undefined && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-card border bg-white px-3.5 text-sm text-ink-800",
            "placeholder:text-ink-300",
            "transition-colors focus:outline-none focus:ring-2",
            leftIcon !== undefined && "ps-10",
            error !== undefined
              ? "border-danger-500 focus:ring-danger-500/30"
              : "border-ink-200 focus:border-primary-400 focus:ring-primary-500/25",
            className,
          )}
          {...props}
        />
      </div>

      {hint !== undefined && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
});
