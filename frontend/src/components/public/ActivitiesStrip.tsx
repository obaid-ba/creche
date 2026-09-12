import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Container, SectionHeading } from "@/components/ui";

/** Each activity gets its own tint so the row reads as five things, not one. */
const ACTIVITIES = [
  { icon: "🎨", key: "arts", field: "bg-primary-100" },
  { icon: "🎵", key: "music", field: "bg-secondary-100" },
  { icon: "📚", key: "stories", field: "bg-sky-100" },
  { icon: "🌱", key: "discovery", field: "bg-mint-100" },
  { icon: "🏃", key: "motor", field: "bg-accent-100" },
] as const;

export function ActivitiesStrip() {
  const { t } = useTranslation();

  return (
    <div>
      <SectionHeading title={t("activities.title")} align="start" />

      <ul className="mt-7 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5">
        {ACTIVITIES.map((activity) => (
          <li key={activity.key} className="text-center">
            <span
              className={`mx-auto grid size-14 place-items-center rounded-full ${activity.field} text-2xl`}
            >
              <span aria-hidden="true">{activity.icon}</span>
            </span>
            <span className="mt-2.5 block text-xs font-bold text-ink-700">
              {t(`activities.${activity.key}`)}
            </span>
          </li>
        ))}
      </ul>

      <Link
        to="/about"
        className="group mt-7 inline-flex h-10 items-center gap-2 rounded-pill bg-shell px-4 text-sm font-bold text-ink-700 shadow-soft ring-1 ring-ink-100 transition-colors hover:bg-ink-50"
      >
        {t("activities.seeAll")}
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}

/** Activities and gallery share a row on wide screens. */
export function ActivitiesAndGallery({ gallery }: { gallery: React.ReactNode }) {
  return (
    <section className="py-4 md:py-8">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
          <ActivitiesStrip />
          {gallery}
        </div>
      </Container>
    </section>
  );
}
