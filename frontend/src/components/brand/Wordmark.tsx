import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";

import { LogoMark } from "./LogoMark";

type Variant = "full" | "compact" | "stacked";

/**
 * The brand lockup in its three working sizes.
 *
 * `full` carries the tagline and is for the footer and wide headers;
 * `compact` drops it for the navbar, where the tagline would be
 * unreadable anyway; `stacked` centres everything for narrow columns.
 *
 * "Crèche" is coral and "Mamati" purple, matching the reference — the
 * two-tone wordmark is the most recognisable part of the identity, so it
 * is set in the display face rather than shipped as an image.
 *
 * The name itself is never translated — a brand is a proper noun, and an
 * Arabic visitor still has to recognise the sign above the door — but
 * the tagline is a sentence, so it is.
 */
export function Wordmark({
  variant = "compact",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { t } = useTranslation();
  const markSize =
    variant === "full" ? "size-14" : variant === "stacked" ? "size-16" : "size-11";

  return (
    <span
      className={cn(
        "flex items-center gap-2.5",
        variant === "stacked" && "flex-col gap-2 text-center",
        className,
      )}
    >
      <LogoMark className={cn(markSize, "shrink-0")} />

      <span className={cn("leading-none", variant === "stacked" && "text-center")}>
        {/* The isolate goes on the parent, not on each word: with one on
            each, the bidi algorithm still reorders the two relative to
            each other and the sign above the door reads "Mamati Crèche"
            in Arabic. */}
        <span
          lang="fr"
          dir="ltr"
          className={cn(
            "block whitespace-nowrap font-display font-extrabold tracking-tight",
            variant === "full" ? "text-2xl" : "text-xl",
          )}
        >
          <span className="text-primary-500">Crèche</span>{" "}
          <span className="text-secondary-700">Mamati</span>
        </span>

        {variant !== "compact" && (
          <span className="mt-0.5 block font-display text-xs font-semibold text-primary-600">
            {t("brand.tagline")}
          </span>
        )}
      </span>
    </span>
  );
}
