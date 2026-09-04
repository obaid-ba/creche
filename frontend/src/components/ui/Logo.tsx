import { Link } from "react-router-dom";

import { NURSERY } from "@/config/nursery";
import { cn } from "@/lib/cn";

/**
 * The brand lockup.
 *
 * Defined once so the mark, its sizing and its link target stay identical
 * across the public site, the auth screens and the app shell.
 */
export function Logo({
  size = "md",
  to = "/",
  className,
}: {
  size?: "sm" | "md";
  to?: string;
  className?: string;
}) {
  const dimensions = size === "sm" ? "size-8" : "size-10";

  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <img
        src={NURSERY.logo}
        alt=""
        width={40}
        height={40}
        // Decorative: the nursery name sits beside it as real text.
        aria-hidden="true"
        className={cn(dimensions, "object-contain")}
      />
      <span
        className={cn(
          "font-display font-bold text-ink-900",
          size === "sm" ? "text-base" : "text-lg",
        )}
      >
        {NURSERY.name}
      </span>
    </Link>
  );
}
