import { Baby, Clock, HeartHandshake, MapPin, Phone, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardBody, LinkButton } from "@/components/ui";
import { GALLERY, NURSERY, NURSERY_FACTS } from "@/config/nursery";
import { GalleryGrid } from "@/features/public/components/GalleryGrid";

/**
 * "La crèche" — the nursery presentation page (brief §4).
 *
 * Built from what is actually known: the four age groups the application
 * itself enforces, the real contact details, and photographs of the
 * premises. The nursery's own history and team are not yet supplied, so
 * that section is deliberately absent rather than invented.
 */

/** Keys, not copy: the boundaries are enforced by the backend, while the
 *  way they are worded belongs to whichever language is being read. */
const AGE_GROUPS = ["infant", "crawler", "toddler", "preschool"] as const;

const VALUES: { icon: LucideIcon; key: string }[] = [
  { icon: HeartHandshake, key: "care" },
  { icon: Sparkles, key: "awakening" },
  { icon: Baby, key: "tracking" },
];

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold">{t("about.title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-ink-600">
          {t("about.lead", {
            name: t("brand.name"),
            from: t(NURSERY_FACTS.ageRange.fromKey),
            to: t(NURSERY_FACTS.ageRange.toKey),
          })}
        </p>
      </header>

      {/* ── Values ──────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">{t("about.approach")}</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-3">
          {VALUES.map(({ icon: Icon, key }) => (
            <li key={key}>
              <Card className="h-full">
                <CardBody>
                  <span className="grid size-11 place-items-center rounded-card bg-primary-100 text-primary-700">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-4 font-bold">{t(`about.${key}.title`)}</h3>
                  <p className="mt-1.5 text-sm text-ink-600">
                    {t(`about.${key}.text`)}
                  </p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Age groups ──────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">{t("about.groups")}</h2>
        <p className="mt-2 text-ink-600">{t("about.groupsLead")}</p>

        <ul className="mt-6 space-y-3">
          {AGE_GROUPS.map((group) => (
            <li key={group}>
              <Card>
                <CardBody className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                  <span className="w-36 shrink-0 font-display font-bold text-primary-700">
                    {t(`about.group.${group}.label`)}
                  </span>
                  <span className="min-w-48 flex-1 text-sm text-ink-600">
                    {t(`about.group.${group}.text`)}
                  </span>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Practical information ───────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">{t("about.practical")}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Card>
            <CardBody>
              <span className="grid size-11 place-items-center rounded-card bg-secondary-100 text-secondary-700">
                <Clock aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">{t("about.hours")}</h3>
              <p className="mt-1.5 text-sm text-ink-600">
                {t(NURSERY_FACTS.openingHours.daysKey)}
                <br />
                <span dir="ltr" className="inline-block">
                  {NURSERY_FACTS.openingHours.from} –{" "}
                  {NURSERY_FACTS.openingHours.to}
                </span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <span className="grid size-11 place-items-center rounded-card bg-accent-100 text-accent-700">
                <Phone aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">{t("about.phone")}</h3>
              <a
                href={NURSERY.phone.href}
                dir="ltr"
                className="mt-1.5 block text-start text-sm font-semibold text-primary-700 underline underline-offset-2"
              >
                {NURSERY.phone.display}
              </a>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <span className="grid size-11 place-items-center rounded-card bg-info-50 text-info-700">
                <MapPin aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">{t("about.address")}</h3>
              <a
                href={NURSERY.location.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block text-sm font-semibold text-primary-700 underline underline-offset-2"
              >
                {t("about.viewOnMaps")}
              </a>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Premises ────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">{t("about.premises")}</h2>
        <p className="mt-2 text-ink-600">{t("about.premisesLead")}</p>
        <div className="mt-6">
          <GalleryGrid items={GALLERY.slice(0, 8)} />
        </div>
        <div className="mt-6">
          <LinkButton to="/gallery" variant="outline">
            {t("gallery.seeAll")}
          </LinkButton>
        </div>
      </section>

      <section className="mt-14 rounded-card bg-primary-50 p-8 text-center">
        <h2 className="text-2xl font-bold">{t("about.meetTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-600">{t("about.meetLead")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton to="/contact">{t("nav.contactUs")}</LinkButton>
          <LinkButton to="/documents" variant="outline">
            {t("cta.registration")}
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
