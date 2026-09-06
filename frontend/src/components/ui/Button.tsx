import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-soft",
  secondary:
    "bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800 shadow-soft",
  outline:
    "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 active:bg-ink-100",
  ghost: "text-ink-600 hover:bg-ink-100 active:bg-ink-200",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700 shadow-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled === true || isLoading}
        // Tells assistive technology the control is working, rather than
        // leaving a screen-reader user with silence after a click.
        aria-busy={isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-pill font-semibold",
          "transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-55",
          VARIANTS[variant],
          SIZES[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);
