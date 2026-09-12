import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Container, SectionHeading } from "@/components/ui";

/**
 * "Une journée chez Mamati" — a miniature of the real parent timeline.
 *
 * The point of this section is to show, before anyone logs in, that the
 * nursery records the day rather than merely claiming to. The moments
 * mirror what the application actually stores, so it is a preview of a
 * real feature and not a decorative illustration.
 */
const MOMENTS = [
  { time: "08:15", icon: "🍼", key: "breakfast" },
  { time: "09:00", icon: "🎨", key: "painting" },
  { time: "10:30", icon: "🌙", key: "nap" },
  { time: "12:00", icon: "🍽️", key: "lunch" },
  { time: "14:30", icon: "🌡️", key: "temperature" },
  { time: "16:00", icon: "🍼", key: "snack" },
] as const;

export function DailyLife() {
  const { t } = useTranslation();

  return (
    <section className="py-14 md:py-20">
      <Container size="wide">
        <SectionHeading title={t("dailyLife.title")} />

        <div className="mt-9 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* The strip scrolls horizontally on narrow screens rather than
              wrapping into an unreadable stack of six rows. */}
          <ol className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:gap-2.5 lg:overflow-visible lg:pb-0">
            {MOMENTS.map((moment, index) => (
              <li
                key={moment.time}
                className="relative flex min-w-[8.5rem] flex-1 snap-start items-center gap-2.5 rounded-panel bg-shell px-3.5 py-3 shadow-soft"
              >
                <span aria-hidden="true" className="text-xl">
                  {moment.icon}
                </span>
                <span className="min-w-0">
                  {/* A clock time is read left-to-right in Arabic too,
                      so the isolate keeps "08:15" from being reordered
                      by the bidi algorithm next to Arabic text. */}
                  <time
                    dir="ltr"
                    className="block font-display text-base font-bold text-primary-600"
                  >
                    {moment.time}
                  </time>
                  <span className="block truncate text-xs text-ink-500">
                    {t(`dailyLife.${moment.key}`)}
                  </span>
                </span>

                {/* Dashed connector between moments, drawn on the gap. */}
                {index < MOMENTS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -end-3 top-1/2 hidden h-px w-3 border-t-2 border-dashed border-ink-200 lg:block"
                  />
                )}
              </li>
            ))}
          </ol>

          <Link
            to="/parent/login"
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-panel bg-secondary-600 px-6 py-4 text-center text-sm font-bold text-white shadow-soft transition-colors hover:bg-secondary-700 lg:max-w-[13rem]"
          >
            {t("dailyLife.cta")}
            <ArrowRight
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
