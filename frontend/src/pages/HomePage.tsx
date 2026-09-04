import {
  Baby,
  Clock,
  Facebook,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardBody, LinkButton } from "@/components/ui";
import { GALLERY, NURSERY, VIDEOS } from "@/config/nursery";
import { GalleryGrid } from "@/features/public/components/GalleryGrid";
import { VideoEmbed } from "@/features/public/components/VideoEmbed";

const VALUES = [
  {
    icon: HeartHandshake,
    title: "Bienveillance",
    text: "Chaque enfant est accueilli avec douceur, écoute et respect de son rythme.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    text: "Des locaux adaptés, une équipe formée et un suivi quotidien rigoureux.",
  },
  {
    icon: Sparkles,
    title: "Éveil",
    text: "Des activités pensées pour développer la curiosité et l'autonomie.",
  },
  {
    icon: MessageCircle,
    title: "Transparence",
    text: "Les parents suivent la journée de leur enfant en temps réel.",
  },
] as const;

const SERVICES = [
  {
    icon: Baby,
    title: "Accueil dès 2 mois",
    text: "Quatre groupes d'âge, de la pouponnière aux grands.",
  },
  {
    icon: Utensils,
    title: "Repas équilibrés",
    text: "Menus adaptés à chaque âge et aux allergies signalées.",
  },
  {
    icon: Palette,
    title: "Activités d'éveil",
    text: "Peinture, musique, motricité, lecture et jeux extérieurs.",
  },
  {
    icon: Clock,
    title: "Horaires souples",
    text: "Ouvert du lundi au vendredi, de 7h30 à 18h30.",
  },
] as const;

export function HomePage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-cream to-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-pill bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 shadow-soft">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Crèche privée · Accueil de 2 mois à 4 ans
            </span>

            <h1 className="mt-5 text-balance text-4xl font-bold leading-tight md:text-5xl">
              Un second foyer pour vos tout-petits
            </h1>

            <p className="mt-4 max-w-lg text-lg text-ink-600">
              À la Crèche Mamati, nous accompagnons chaque enfant avec
              bienveillance — et nous tenons les parents informés de chaque
              moment de la journée.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/parent/login"
                className="inline-flex h-12 items-center rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-600"
              >
                Espace parents
              </Link>
              <Link
                to="/documents"
                className="inline-flex h-12 items-center rounded-pill border border-ink-200 bg-white px-6 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50"
              >
                Dossier d'inscription
              </Link>
            </div>
          </div>

          <div className="relative">
            <img
              src={GALLERY[0]?.src ?? ""}
              alt={GALLERY[0]?.alt ?? ""}
              // The hero is the first thing painted, so it is fetched
              // eagerly at high priority rather than lazily. Dimensions
              // match the rendered 4:3 box.
              width={800}
              height={600}
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/3] w-full rounded-card object-cover shadow-lifted"
            />
            <Card className="absolute -bottom-5 left-4 w-56 md:left-8">
              <CardBody className="p-4">
                <p className="text-xs font-semibold text-ink-400">
                  Aujourd'hui · Mohamed
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-800">
                  <span aria-hidden="true">😴</span> Sieste · 1h15
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink-800">
                  <span aria-hidden="true">🎨</span> Atelier peinture
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="text-center text-3xl font-bold">Nos valeurs</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-600">
          Ce qui guide notre équipe au quotidien.
        </p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="h-full">
                <CardBody>
                  <span className="grid size-11 place-items-center rounded-card bg-primary-100 text-primary-700">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-600">{text}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Services ────────────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Nos services</h2>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-card bg-secondary-100 text-secondary-700">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Parent portal CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <Card className="overflow-hidden">
          <div className="grid gap-8 bg-gradient-to-br from-secondary-50 to-primary-50 p-8 md:grid-cols-2 md:items-center md:p-12">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">
                Suivez la journée de votre enfant
              </h2>
              <p className="mt-3 text-ink-600">
                Repas, siestes, activités, température et messages de l'équipe :
                tout est consultable depuis votre espace parent, à tout moment.
              </p>
              <Link
                to="/parent/login"
                className="mt-6 inline-flex h-12 items-center rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-600"
              >
                Accéder à mon espace
              </Link>
            </div>

            <ul className="space-y-3">
              {[
                { time: "08:15", icon: "🍼", label: "Petit déjeuner · 180 ml" },
                { time: "09:00", icon: "🎨", label: "Activité peinture" },
                { time: "10:30", icon: "😴", label: "Sommeil · 1h15" },
                { time: "14:30", icon: "🌡️", label: "Température · 36,6 °C" },
              ].map((event) => (
                <li
                  key={event.time}
                  className="flex items-center gap-3 rounded-card bg-white/80 px-4 py-3 shadow-soft"
                >
                  <span className="w-12 shrink-0 text-xs font-bold text-ink-400">
                    {event.time}
                  </span>
                  <span aria-hidden="true">{event.icon}</span>
                  <span className="text-sm font-semibold text-ink-700">
                    {event.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      {/* ── Gallery preview ─────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Nos locaux</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-ink-600">
            Des espaces pensés pour l'éveil, le repos et la sécurité.
          </p>

          <div className="mt-10">
            <GalleryGrid items={GALLERY.slice(0, 8)} />
          </div>

          <div className="mt-8 text-center">
            <LinkButton to="/gallery" variant="outline">
              Voir toute la galerie
            </LinkButton>
          </div>
        </div>
      </section>

      {/* ── Videos ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="text-center text-3xl font-bold">En vidéo</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-600">
          Découvrez la vie quotidienne à la Crèche Mamati.
        </p>

        <ul className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
          {VIDEOS.map((video) => (
            <li key={video.src}>
              <VideoEmbed video={video} />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────── */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-3">
          {[
            {
              icon: Phone,
              title: "Téléphone",
              body: (
                <a
                  href={NURSERY.phone.href}
                  className="text-sm font-semibold text-primary-700 underline underline-offset-2"
                >
                  {NURSERY.phone.display}
                </a>
              ),
            },
            {
              icon: MapPin,
              title: "Nous trouver",
              body: (
                <a
                  href={NURSERY.location.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primary-700 underline underline-offset-2"
                >
                  Voir sur Google Maps
                </a>
              ),
            },
            {
              icon: Facebook,
              title: "Facebook",
              body: (
                <a
                  href={NURSERY.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-primary-700 underline underline-offset-2"
                >
                  Suivre notre page
                </a>
              ),
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-card bg-accent-100 text-accent-500">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-1">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
