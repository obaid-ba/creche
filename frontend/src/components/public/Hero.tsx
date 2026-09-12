import { ArrowRight, Clock, FileText, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  Cloud,
  Decor,
  FlightPath,
  Heart,
  Leaf,
  Sparkle,
  Sun,
} from "@/components/public/Decorations";
import { Container } from "@/components/ui";
import { GALLERY, NURSERY_FACTS } from "@/config/nursery";

/**
 * The hero.
 *
 * Deliberately not "text left, rectangle right": the photograph sits in
 * an organic blob with a second purple shape behind it, and a details
 * card overlaps the lower edge. The heading mixes two colours so the
 * brand reads even before the logo is noticed.
 */
export function Hero() {
  const { t } = useTranslation();
  const cover = GALLERY[0];

  return (
    <section className="relative overflow-hidden pb-10 pt-8 md:pb-16 md:pt-12">
      {/* Decorative layer — all hidden from assistive technology. */}
      <Decor className="start-2 top-10 md:start-6 md:top-14" float>
        <Sun className="size-16 md:size-20" />
      </Decor>
      <Decor className="start-[34%] top-4 hidden md:block">
        <Cloud className="w-20" />
      </Decor>
      <Decor className="end-[6%] top-8 hidden text-primary-300 lg:block" float>
        <Heart className="size-7" />
      </Decor>
      <Decor className="start-[41%] top-24 hidden text-primary-200 md:block">
        <Heart className="size-5" />
      </Decor>
      <Decor className="start-3 top-[46%] hidden text-secondary-300 md:block">
        <Sparkle className="size-5" />
      </Decor>
      <Decor className="bottom-[22%] start-6 hidden md:block">
        <Leaf className="w-10" />
      </Decor>
      <Decor className="bottom-[16%] start-[36%] hidden lg:block">
        <FlightPath className="w-28" />
      </Decor>

      <Container size="wide">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
          {/* ── Copy ────────────────────────────────────────────────── */}
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-pill bg-primary-50 px-3.5 py-1.5 text-sm font-bold text-primary-700 ring-1 ring-primary-100">
              <Heart className="size-3.5 text-primary-400" />
              {t("hero.badge", {
                kind: t(NURSERY_FACTS.kind.labelKey),
                from: t(NURSERY_FACTS.ageRange.fromKey),
                to: t(NURSERY_FACTS.ageRange.toKey),
              })}
            </span>

            <h1 className="mt-5 text-[2.6rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              {t("hero.titleLine1")}
              <br />
              <span className="text-primary-500">{t("hero.titleHighlight")}</span>{" "}
              {t("hero.titleRest")}
            </h1>

            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-500">
              {t("hero.lead", { name: t("brand.name") })}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/about"
                className="group inline-flex h-12 items-center gap-2 rounded-pill bg-primary-600 px-6 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
              >
                {t("hero.discover")}
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              <Link
                to="/documents"
                className="inline-flex h-12 items-center gap-2 rounded-pill bg-shell px-6 text-sm font-bold text-ink-700 shadow-soft ring-1 ring-ink-100 transition-colors hover:bg-ink-50"
              >
                <FileText aria-hidden="true" className="size-4 text-secondary-500" />
                {t("hero.registration")}
              </Link>
            </div>
          </div>

          {/* ── Image ───────────────────────────────────────────────── */}
          <div className="relative">
            {/* Purple shape offset past the photograph's edge so it
                actually shows; sitting directly behind it, it was
                completely covered. */}
            <span
              aria-hidden="true"
              className="absolute -bottom-4 end-0 z-0 hidden h-[62%] w-[46%] blob-b bg-secondary-300 md:block"
            />
            <span
              aria-hidden="true"
              className="absolute -start-8 top-2 z-0 hidden size-32 blob-c bg-primary-100 lg:block"
            />

            <img
              src={cover?.src ?? ""}
              alt={cover === undefined ? "" : t(cover.altKey)}
              width={900}
              height={700}
              fetchPriority="high"
              decoding="async"
              className="blob-a relative z-10 aspect-[9/7] w-[86%] object-cover shadow-lifted"
            />

            {/* Practical details, overlapping the photo's lower edge. */}
            <div className="absolute -bottom-6 end-2 z-20 w-[15rem] rounded-panel bg-shell/95 p-4 shadow-float backdrop-blur sm:end-6">
              {/* A two-column grid rather than wrapper <div>s: a <dl>
                  whose children are divs fails the definition-list rule,
                  and the icon can sit in its own column instead. */}
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                <span
                  aria-hidden="true"
                  className="row-span-2 grid size-9 place-items-center rounded-card bg-secondary-50 text-secondary-600"
                >
                  <Clock className="size-4" />
                </span>
                <dt className="self-end text-xs font-bold text-ink-900">
                  {t("hero.hours")}
                </dt>
                {/* An opening-hours range reads left-to-right in Arabic
                    as well; without the isolate the bidi algorithm
                    swaps the two ends of the range. */}
                <dd dir="ltr" className="self-start text-start text-sm text-ink-500">
                  {NURSERY_FACTS.openingHours.from} – {NURSERY_FACTS.openingHours.to}
                </dd>

                <span
                  aria-hidden="true"
                  className="row-span-2 mt-3 grid size-9 place-items-center rounded-card bg-primary-50 text-primary-600"
                >
                  <MapPin className="size-4" />
                </span>
                <dt className="mt-3 self-end text-xs font-bold text-ink-900">
                  {t("hero.location")}
                </dt>
                <dd className="self-start text-sm text-ink-500">
                  {t("facts.city")}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
