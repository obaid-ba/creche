import { Heart, Shield, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Container } from "@/components/ui";

/**
 * The four values, as one white band rather than four separate cards.
 *
 * Each icon sits in its own tinted field — the only place the pastel
 * palette appears at any size. Keeping them in a single panel stops the
 * page becoming the grid of identical boxes the brief warns against.
 */
const VALUES: {
  icon: LucideIcon;
  title: string;
  lines: [string, string];
  field: string;
  ink: string;
}[] = [
  {
    icon: Heart,
    title: "Bienveillance",
    lines: ["Un accueil chaleureux", "et attentif"],
    field: "bg-primary-100",
    ink: "text-primary-600",
  },
  {
    icon: Shield,
    title: "Sécurité",
    lines: ["Un environnement sûr", "et adapté"],
    field: "bg-sky-100",
    ink: "text-sky-700",
  },
  {
    icon: Star,
    title: "Éveil",
    lines: ["Des activités stimulantes", "et éducatives"],
    field: "bg-accent-100",
    ink: "text-accent-700",
  },
  {
    icon: Users,
    title: "Transparence",
    lines: ["Une communication claire", "avec les parents"],
    field: "bg-mint-100",
    ink: "text-mint-700",
  },
];

export function ValuesBand() {
  return (
    <section aria-label="Nos valeurs" className="relative z-10 pt-8 md:pt-14">
      <Container size="wide">
        <ul className="grid gap-6 rounded-panel bg-shell px-6 py-7 shadow-soft sm:grid-cols-2 sm:gap-7 lg:grid-cols-4 lg:px-8">
          {VALUES.map(({ icon: Icon, title, lines, field, ink }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full ${field} ${ink}`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-snug text-ink-500">
                  {lines[0]}
                  <br />
                  {lines[1]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
