import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Heart } from "@/components/public/Decorations";

/**
 * A section title.
 *
 * The small coral heart beside it is the reference's recurring motif and
 * the cheapest way to make headings feel like this brand rather than a
 * generic template. It is decorative, so it is hidden from assistive
 * technology and the heading text stands alone.
 */
export function SectionHeading({
  title,
  subtitle,
  align = "center",
  withHeart = true,
  as: Tag = "h2",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  // "start" rather than "left": the heading already renders with
  // `text-start`, so the name should not promise a physical side.
  align?: "start" | "center";
  withHeart?: boolean;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "text-center" : "text-start",
        className,
      )}
    >
      <Tag
        className={cn(
          "inline-flex flex-wrap items-center gap-2.5 text-3xl md:text-[2rem]",
          align === "center" && "justify-center",
        )}
      >
        {title}
        {withHeart && (
          <Heart className="size-5 shrink-0 text-primary-400" />
        )}
      </Tag>

      {subtitle !== undefined && (
        <p
          className={cn(
            "mt-3 text-ink-500",
            align === "center" && "mx-auto max-w-xl",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
