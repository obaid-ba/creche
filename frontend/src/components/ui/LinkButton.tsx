import { Link, type LinkProps } from "react-router-dom";

import { cn } from "@/lib/cn";

/**
 * A router Link styled as a button.
 *
 * Exists so we never nest an <a> inside a <button>, which is invalid HTML
 * and breaks keyboard and screen-reader behaviour. Anything that
 * navigates is a link; anything that acts is a button.
 */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkProps & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-primary-500 text-white hover:bg-primary-600 shadow-soft",
    outline:
      "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50",
    ghost: "text-ink-600 hover:bg-ink-100",
  } as const;

  const sizes = {
    sm: "h-9 px-3 text-sm gap-1.5",
    md: "h-11 px-5 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5",
  } as const;

  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-semibold transition-colors",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
