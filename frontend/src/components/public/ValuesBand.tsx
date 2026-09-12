import { Heart, Shield, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Container } from "@/components/ui";

/**
 * The four values, as one white band rather than four separate cards.
 *
 * Each icon sits in its own tinted field — the only place the pastel
 * palette appears at any size. Keeping them in a single panel stops the
 * page becoming the grid of identical boxes the brief warns against.
 */
const VALUES: { icon: LucideIcon; key: string; field: string; ink: string }[] = [
  { icon: Heart, key: "care", field: "bg-primary-100", ink: "text-primary-600" },
  { icon: Shield, key: "safety", field: "bg-sky-100", ink: "text-sky-700" },
  { icon: Star, key: "awakening", field: "bg-accent-100", ink: "text-accent-700" },
  { icon: Users, key: "transparency", field: "bg-mint-100", ink: "text-mint-700" },
];

export function ValuesBand() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("values.sectionLabel")}
      className="relative z-10 pt-8 md:pt-14"
    >
      <Container size="wide">
        <ul className="grid gap-6 rounded-panel bg-shell px-6 py-7 shadow-soft sm:grid-cols-2 sm:gap-7 lg:grid-cols-4 lg:px-8">
          {VALUES.map(({ icon: Icon, key, field, ink }) => (
            <li key={key} className="flex items-start gap-3.5">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full ${field} ${ink}`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold">{t(`values.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-snug text-ink-500">
                  {t(`values.${key}.line1`)}
                  <br />
                  {t(`values.${key}.line2`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
