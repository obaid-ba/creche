import { Facebook, MapPin, Phone } from "lucide-react";

import { Card, CardBody } from "@/components/ui";
import { NURSERY } from "@/config/nursery";

export function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold">Nous contacter</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-600">
          Une question sur l'inscription ou une visite ? Appelez-nous.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-card bg-primary-100 text-primary-700">
              <Phone aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 font-bold">Téléphone</h2>
            <a
              href={NURSERY.phone.href}
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
            <h2 className="mt-3 font-bold">Adresse</h2>
            <a
              href={NURSERY.location.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm font-semibold text-primary-700 underline underline-offset-2"
            >
              Ouvrir dans Google Maps
            </a>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-card bg-info-50 text-info-700">
              <Facebook aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 font-bold">Facebook</h2>
            <a
              href={NURSERY.facebook}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-sm font-semibold text-primary-700 underline underline-offset-2"
            >
              Suivre notre page
            </a>
          </CardBody>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Nous trouver</h2>
        <div className="overflow-hidden rounded-card shadow-soft">
          <iframe
            src={NURSERY.location.embedUrl}
            title={`Localisation de ${NURSERY.name}`}
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
