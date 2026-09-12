import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * One horizontal rhythm for the whole site.
 *
 * Every section used to repeat `mx-auto max-w-6xl px-4 sm:px-6`; when a
 * section forgot part of it, its content drifted out of alignment with
 * the one above. Defining the measure once removes that class of bug.
 */
export function Container({
  children,
  size = "default",
  className,
}: {
  children: ReactNode;
  size?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const widths = {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-7xl",
  } as const;

  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", widths[size], className)}>
      {children}
    </div>
  );
}
