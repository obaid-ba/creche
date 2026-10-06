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
interface Moment {
  /** Start, or the only time when `until` is absent. */
  time: string;
  /** Set only for the moments that occupy a span rather than an instant. */
  until?: string;
  icon: string;
  key: string;
}

/** The nursery's actual timetable, confirmed 2026-10-06. Snack and
 *  activities happen twice a day, so the keys are suffixed rather than
 *  shared — the label reads the same, but a shared key would make the
 *  two impossible to word differently later. */
const MOMENTS: Moment[] = [
  { time: "07:30", icon: "🍼", key: "breakfast" },
  { time: "09:00", icon: "🍎", key: "snackMorning" },
  { time: "09:30", until: "11:00", icon: "🎨", key: "activitiesMorning" },
  { time: "11:15", icon: "🍽️", key: "lunch" },
  { time: "12:00", until: "14:00", icon: "🌙", key: "nap" },
  { time: "14:15", icon: "🍎", key: "snackAfternoon" },
  { time: "15:00", until: "17:00", icon: "🧩", key: "activitiesAfternoon" },
];

export function DailyLife() {
  const { t } = useTranslation();

  return (
    <section className="py-14 md:py-20">
      <Container size="wide">
        <SectionHeading title={t("dailyLife.title")} />

        {/* The CTA sits below the strip rather than beside it: seven
            moments, three of them time spans, leave no room for a button
            on the same row. */}
        <div className="mt-9 flex flex-col gap-5">
          {/* The strip scrolls horizontally until it genuinely fits —
              at xl, not lg: seven cards plus their gaps need more than a
              1024px viewport and would otherwise overflow the section. */}
          <ol className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 xl:gap-2.5 xl:overflow-visible xl:pb-0">
            {MOMENTS.map((moment, index) => (
              <li
                key={moment.time}
                className="relative flex min-w-[9.5rem] flex-1 snap-start items-center gap-2.5 rounded-panel bg-shell px-3.5 py-3 shadow-soft"
              >
                <span aria-hidden="true" className="text-xl">
                  {moment.icon}
                </span>
                <span className="min-w-0">
                  {/* A clock time is read left-to-right in Arabic too, so
                      the isolate keeps "09:30" from being reordered by the
                      bidi algorithm next to Arabic text. For a span it
                      goes on the wrapper, not on each <time>: two
                      separately isolated times would let the dash and the
                      order between them flip in RTL. */}
                  <span
                    dir="ltr"
                    className="block font-display text-sm font-bold text-primary-600"
                  >
                    <time>{moment.time}</time>
                    {moment.until ? (
                      <>
                        <span aria-hidden="true">–</span>
                        <time>{moment.until}</time>
                      </>
                    ) : null}
                  </span>
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
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-panel bg-secondary-600 px-6 py-4 text-center text-sm font-bold text-white shadow-soft transition-colors hover:bg-secondary-700 sm:self-center sm:px-8"
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
