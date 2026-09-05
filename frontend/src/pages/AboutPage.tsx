import { Baby, Clock, HeartHandshake, MapPin, Phone, Sparkles } from "lucide-react";

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

const AGE_GROUPS = [
  { label: "2 → 6 mois", text: "Pouponnière : rythme individuel, sommeil et biberons à la demande." },
  { label: "7 mois → 1 an", text: "Premiers déplacements, diversification alimentaire, éveil sensoriel." },
  { label: "1 → 2 ans", text: "Marche, langage, motricité libre et premiers jeux collectifs." },
  { label: "2 ans et +", text: "Autonomie, activités créatives et préparation à l'école." },
] as const;

const VALUES = [
  {
    icon: HeartHandshake,
    title: "Bienveillance",
    text: "Chaque enfant est accueilli avec douceur et au respect de son rythme.",
  },
  {
    icon: Sparkles,
    title: "Éveil",
    text: "Des activités quotidiennes pensées pour la curiosité et l'autonomie.",
  },
  {
    icon: Baby,
    title: "Suivi individuel",
    text: "Repas, sommeil, santé et humeur consignés chaque jour pour chaque enfant.",
  },
] as const;

export function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold">La crèche</h1>
        <p className="mx-auto mt-3 max-w-2xl text-ink-600">
          {NURSERY.name} accueille les tout-petits de{" "}
          {NURSERY_FACTS.ageRange.from} à {NURSERY_FACTS.ageRange.to} dans un
          cadre chaleureux et sécurisé, et tient les parents informés de
          chaque moment de la journée.
        </p>
      </header>

      {/* ── Values ──────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">Notre approche</h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="h-full">
                <CardBody>
                  <span className="grid size-11 place-items-center rounded-card bg-primary-100 text-primary-700">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-600">{text}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Age groups ──────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">Nos groupes</h2>
        <p className="mt-2 text-ink-600">
          Les enfants sont répartis en quatre groupes, déterminés
          automatiquement à partir de leur date de naissance.
        </p>

        <ul className="mt-6 space-y-3">
          {AGE_GROUPS.map((group) => (
            <li key={group.label}>
              <Card>
                <CardBody className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                  <span className="w-32 shrink-0 font-display font-bold text-primary-700">
                    {group.label}
                  </span>
                  <span className="min-w-48 flex-1 text-sm text-ink-600">
                    {group.text}
                  </span>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Practical information ───────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">Informations pratiques</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Card>
            <CardBody>
              <span className="grid size-11 place-items-center rounded-card bg-secondary-100 text-secondary-700">
                <Clock aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">Horaires</h3>
              <p className="mt-1.5 text-sm text-ink-600">
                {NURSERY_FACTS.openingHours.days}
                <br />
                {NURSERY_FACTS.openingHours.from} – {NURSERY_FACTS.openingHours.to}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <span className="grid size-11 place-items-center rounded-card bg-accent-100 text-accent-500">
                <Phone aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">Téléphone</h3>
              <a
                href={NURSERY.phone.href}
                className="mt-1.5 block text-sm font-semibold text-primary-700 underline underline-offset-2"
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
              <h3 className="mt-4 font-bold">Adresse</h3>
              <a
                href={NURSERY.location.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block text-sm font-semibold text-primary-700 underline underline-offset-2"
              >
                Voir sur Google Maps
              </a>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Premises ────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold">Nos locaux</h2>
        <p className="mt-2 text-ink-600">
          Des espaces d'éveil, de repos et de jeu, pensés pour les tout-petits.
        </p>
        <div className="mt-6">
          <GalleryGrid items={GALLERY.slice(0, 8)} />
        </div>
        <div className="mt-6">
          <LinkButton to="/gallery" variant="outline">
            Voir toute la galerie
          </LinkButton>
        </div>
      </section>

      <section className="mt-14 rounded-card bg-primary-50 p-8 text-center">
        <h2 className="text-2xl font-bold">Envie de nous rencontrer ?</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-600">
          Contactez-nous pour visiter la crèche ou retirer un dossier
          d'inscription.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton to="/contact">Nous contacter</LinkButton>
          <LinkButton to="/documents" variant="outline">
            Dossier d'inscription
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
