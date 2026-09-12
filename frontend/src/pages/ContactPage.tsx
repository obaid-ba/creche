import { Facebook, MapPin, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardBody } from "@/components/ui";
import { NURSERY } from "@/config/nursery";

export function ContactPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold">{t("nav.contactUs")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-600">
          {t("contactPage.lead")}
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-card bg-primary-100 text-primary-700">
              <Phone aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 font-bold">{t("contactPage.phone")}</h2>
            <a
              href={NURSERY.phone.href}
              dir="ltr"
              className="mt-1 block text-lg font-bold text-primary-700 underline underline-offset-4"
            >
              {NURSERY.phone.display}
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-card bg-secondary-100 text-secondary-700">
              <MapPin aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 font-bold">{t("contactPage.address")}</h2>
            <a
              href={NURSERY.location.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm font-semibold text-primary-700 underline underline-offset-2"
            >
              {t("contactPage.openInMaps")}
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-card bg-info-50 text-info-700">
              <Facebook aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 font-bold">{t("contactPage.facebook")}</h2>
            <a
              href={NURSERY.facebook}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm font-semibold text-primary-700 underline underline-offset-2"
            >
              {t("contactPage.followPage")}
            </a>
          </CardBody>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">{t("contactPage.findUs")}</h2>
        <div className="overflow-hidden rounded-card shadow-soft">
          <iframe
            src={NURSERY.location.embedUrl}
            title={t("contactPage.mapTitle", { name: t("brand.name") })}
            // Deferred: the map is below the fold and third-party.
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-80 w-full border-0"
          />
        </div>
      </section>
    </div>
  );
}
