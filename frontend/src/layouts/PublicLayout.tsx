import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { to: "/", label: "Accueil" },
  { to: "/about", label: "La crèche" },
  { to: "/gallery", label: "Galerie" },
  { to: "/documents", label: "Inscription" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Lets keyboard and screen-reader users skip the nav on every page. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu principal
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-100 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-primary-500 text-lg">
              🧸
            </span>
            <span className="font-display text-lg font-bold text-ink-900">
              Crèche Mamati
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "rounded-pill px-3 py-2 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-primary-100 text-primary-800"
                          : "text-ink-600 hover:bg-ink-100",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden md:block">
            <Button size="sm" onClick={() => undefined}>
              Espace parents
            </Button>
          </div>

          <button
            type="button"
            className="rounded-pill p-2 text-ink-600 hover:bg-ink-100 md:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="menu-mobile"
            aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {isMenuOpen && (
          <nav
            id="menu-mobile"
            aria-label="Navigation mobile"
            className="border-t border-ink-100 bg-cream px-4 pb-4 md:hidden"
          >
            <ul className="flex flex-col gap-1 pt-2">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-card px-3 py-2.5 text-sm font-semibold",
                        isActive
                          ? "bg-primary-100 text-primary-800"
                          : "text-ink-600 hover:bg-ink-100",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-ink-500 sm:px-6">
          <p>
            © {new Date().getFullYear()} Crèche Mamati — Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
