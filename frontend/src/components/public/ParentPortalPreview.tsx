import { ArrowRight, Smile, Thermometer } from "lucide-react";
import { Link } from "react-router-dom";

import { Decor, Heart, Sparkle } from "@/components/public/Decorations";
import { Container } from "@/components/ui";

/**
 * A mock of the parent dashboard, on the public page.
 *
 * This is the section that makes the site read as a product rather than
 * a brochure — a parent choosing a nursery can see exactly what they
 * would get. The figures mirror the real dashboard's shape (mood, sleep,
 * temperature, then the day's timeline) so the promise matches what the
 * application delivers.
 */
const TIMELINE = [
  { time: "08:15", icon: "🍼", label: "Petit déjeuner", detail: "Biberon 180 ml" },
  { time: "09:00", icon: "🎨", label: "Atelier peinture", detail: "Activité créative" },
  { time: "10:30", icon: "🌙", label: "Sieste", detail: "Durée 1h15" },
  { time: "12:00", icon: "🍽️", label: "Déjeuner", detail: "Purée + yaourt" },
] as const;

export function ParentPortalPreview() {
  return (
    <section className="relative overflow-hidden py-14 md:py-20">
      <Container size="wide">
        <div className="relative overflow-hidden rounded-panel bg-gradient-to-br from-secondary-50 via-primary-50/60 to-secondary-100/70 px-5 py-10 md:px-10 md:py-12">
          <Decor className="right-8 top-8 text-accent-300">
            <Sparkle className="size-6" />
          </Decor>
          <Decor className="bottom-10 left-8 text-primary-200" float>
            <Heart className="size-6" />
          </Decor>

          <div className="grid items-center gap-9 lg:grid-cols-[0.85fr_1.15fr]">
            {/* ── Pitch ───────────────────────────────────────────── */}
            <div className="relative z-10">
              <h2 className="text-3xl leading-tight md:text-[2.1rem]">
                Gardez un œil sur
                <br />
                chaque <span className="text-primary-500">petit moment</span>
              </h2>

              <p className="mt-4 max-w-sm text-ink-500">
                Depuis votre espace parent, découvrez la journée de votre
                enfant : repas, sommeil, activités, humeur et bien plus encore.
              </p>

              <Link
                to="/parent/login"
                className="group mt-7 inline-flex h-12 items-center gap-2 rounded-pill bg-primary-600 px-6 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700"
              >
                Accéder à mon espace
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>

            {/* ── Dashboard mock ──────────────────────────────────── */}
            {/* Decorative as a whole: it illustrates the product rather
                than presenting real data, so it is hidden from screen
                readers, which the prose above already serves. */}
            <div
              aria-hidden="true"
              className="rounded-panel bg-shell/95 p-5 shadow-float backdrop-blur"
            >
              <p className="font-display text-lg font-bold">Bonjour, maman 👋</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_1fr_1fr] sm:items-center">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-100 font-display font-bold text-primary-700">
                    M
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink-900">
                      Mohamed
                    </span>
                    <span className="block text-xs text-ink-400">18 mois</span>
                  </span>
                </div>

                <Stat
                  label="Humeur du jour"
                  value="Heureux"
                  icon={<Smile className="size-4 text-accent-500" />}
                />
                <Stat label="Sieste" value="1h15" detail="10:30 – 11:45" />
                <Stat
                  label="Température"
                  value="36,6 °C"
                  icon={<Thermometer className="size-4 text-primary-500" />}
                />
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-400">
                Aujourd'hui
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TIMELINE.map((item) => (
                  <li
                    key={item.time}
                    className="rounded-card bg-cream-deep/70 px-3 py-2.5"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                      <span>{item.icon}</span>
                      {item.time}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-ink-700">
                      {item.label}
                    </span>
                    <span className="block text-[0.7rem] text-ink-400">
                      {item.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-cream-deep/70 px-3 py-2.5">
      <span className="block text-[0.7rem] font-semibold text-ink-400">
        {label}
      </span>
      <span className="mt-0.5 flex items-center gap-1.5 font-display text-base font-bold text-ink-900">
        {icon}
        {value}
      </span>
      {detail !== undefined && (
        <span className="block text-[0.7rem] text-ink-400">{detail}</span>
      )}
    </div>
  );
}
