import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The heading block every application screen opens with.
 *
 * Each page had grown its own `<h1>` with its own spacing, so the gap
 * above the first card differed screen to screen — small on its own,
 * visible the moment you move between two of them.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
          {title}
        </h1>
        {description !== undefined && (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * The standard page measure and padding for application screens.
 *
 * Three measures rather than one: a list of children wants the full
 * width the rail leaves, while a single-column form at 80rem is a line
 * length nobody can track back from. Every screen picking its own
 * `max-w-*` is how the gap above the first card ended up different on
 * each one.
 */
const MEASURES = {
  default: "max-w-7xl",
  wide: "max-w-6xl",
  form: "max-w-3xl",
} as const;

export function PageShell({
  children,
  size = "default",
  className,
}: {
  children: ReactNode;
  size?: keyof typeof MEASURES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-7 sm:px-6 lg:px-8",
        MEASURES[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
