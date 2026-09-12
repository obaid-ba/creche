import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui";
import { NURSERY, NURSERY_FACTS } from "@/config/nursery";

const NAVIGATION = [
  { to: "/", label: "Accueil" },
  { to: "/about", label: "La crèche" },
  { to: "/gallery", label: "Galerie" },
  { to: "/documents", label: "Inscription" },
  { to: "/contact", label: "Contact" },
] as const;

const PARENT_LINKS = [
  { to: "/parent/login", label: "Connexion parent" },
  { to: "/parent/activation", label: "Activer mon compte" },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-shell pb-8 pt-12">
      <Container size="wide">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Wordmark variant="full" />
          </div>

          <FooterColumn title="Navigation">
            {NAVIGATION.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm text-ink-500 transition-colors hover:text-primary-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Espace parents">
            {PARENT_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-sm text-ink-500 transition-colors hover:text-primary-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Nous contacter">
            <li>
              <a
                href={NURSERY.phone.href}
                className="flex items-center gap-2 text-sm text-ink-500 transition-colors hover:text-primary-600"
              >
                <Phone aria-hidden="true" className="size-3.5 shrink-0" />
                {NURSERY.phone.display}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${NURSERY.email}`}
                className="flex items-center gap-2 text-sm text-ink-500 transition-colors hover:text-primary-600"
              >
                <Mail aria-hidden="true" className="size-3.5 shrink-0" />
                {NURSERY.email}
              </a>
            </li>
            <li>
              <a
                href={NURSERY.location.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-ink-500 transition-colors hover:text-primary-600"
              >
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                Tunis, Tunisie
              </a>
            </li>
          </FooterColumn>

          <FooterColumn title="Horaires">
            <li className="flex items-start gap-2 text-sm text-ink-500">
              <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {NURSERY_FACTS.openingHours.days}
                <br />
                {NURSERY_FACTS.openingHours.from} – {NURSERY_FACTS.openingHours.to}
              </span>
            </li>

            <li className="pt-2">
              <span className="mb-2 block text-xs font-bold text-ink-900">
                Suivez-nous
              </span>
              <span className="flex gap-2">
                <a
                  href={NURSERY.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="grid size-8 place-items-center rounded-full bg-ink-50 text-ink-500 transition-colors hover:bg-primary-100 hover:text-primary-700"
                >
                  <Facebook aria-hidden="true" className="size-4" />
                </a>
                <span
                  aria-hidden="true"
                  title="Instagram — à venir"
                  className="grid size-8 place-items-center rounded-full bg-ink-50 text-ink-300"
                >
                  <Instagram className="size-4" />
                </span>
              </span>
            </li>
          </FooterColumn>
        </div>

        <p className="mt-10 border-t border-ink-100 pt-5 text-center text-xs text-ink-400">
          © {new Date().getFullYear()} {NURSERY.name}. Tous droits réservés.
        </p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-ink-900">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}
