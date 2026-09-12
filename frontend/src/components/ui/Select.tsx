import { ChevronDown } from "lucide-react";
import { forwardRef, useId, type SelectHTMLAttributes } from "react";

import { useFieldError } from "@/i18n/useFieldError";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  error?: string | undefined;
  hint?: string | undefined;
  /** Leading blank option, e.g. "Tous les groupes". */
  placeholder?: string | undefined;
  /** Visually hide the label when the surrounding context already names it. */
  hideLabel?: boolean;
}

/**
 * The counterpart to Input.
 *
 * Nine screens had grown their own copy of the same `<select>` markup and
 * Tailwind classes, which is exactly the duplication the design system is
 * meant to prevent. Field styling, error wiring and the label/`aria`
 * relationship now live in one place — as does resolving `error` and
 * `hint` through i18next; see Input for why that happens here rather
 * than at each call site.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error: rawError, hint: rawHint, placeholder, hideLabel = false, className, id, ...props },
  ref,
) {
  const resolve = useFieldError();
  const error = resolve(rawError);
  const hint = resolve(rawHint);

  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="w-full">
      <label
        htmlFor={selectId}
        className={cn(
          "mb-1.5 block text-sm font-semibold text-ink-700",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      {/* The native control keeps its own popup — it is the only one
          that behaves correctly on a phone and with a screen reader —
          but its closed state is drawn by the platform and looks nothing
          like the rest of the fields. `appearance-none` removes that
          chrome, and the chevron below replaces it. */}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full appearance-none rounded-card border bg-shell ps-3.5 pe-10",
            "text-sm font-medium text-ink-800",
            "transition-colors focus:outline-none focus:ring-2",
            error !== undefined
              ? "border-danger-500 focus:ring-danger-500/30"
              : "border-ink-200 hover:border-ink-300 focus:border-primary-400 focus:ring-primary-500/25",
            className,
          )}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
        />
      </div>

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
});
