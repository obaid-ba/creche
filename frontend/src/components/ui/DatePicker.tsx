import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  hideLabel?: boolean;
}

/** Local YYYY-MM-DD. `toISOString` would shift the day across timezones. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * A single date field.
 *
 * Wraps the native control rather than reimplementing a calendar: it is
 * keyboard accessible, localised and touch-friendly for free, and staff
 * enter dates constantly. `DateSelector` in the timeline feature is the
 * different thing — day-stepping with Today/Yesterday shortcuts.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    { label, error, hint, hideLabel = false, className, id, ...props },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const describedBy =
      [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className="w-full">
        <label
          htmlFor={inputId}
          className={cn(
            "mb-1.5 block text-sm font-semibold text-ink-700",
            hideLabel && "sr-only",
          )}
        >
          {label}
        </label>

        <input
          ref={ref}
          id={inputId}
          type="date"
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-card border bg-white px-3.5 text-sm text-ink-800",
            "transition-colors focus:outline-none focus:ring-2",
            error !== undefined
              ? "border-danger-500 focus:ring-danger-500/30"
              : "border-ink-200 focus:border-primary-400 focus:ring-primary-500/25",
            className,
          )}
          {...props}
        />

        {hint !== undefined && (
          <p id={hintId} className="mt-1.5 text-xs text-ink-500">
            {hint}
          </p>
        )}
        {error !== undefined && (
          <p
            id={errorId}
            role="alert"
            className="mt-1.5 text-xs font-semibold text-danger-700"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
