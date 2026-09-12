import { Menu, Phone, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { Container, LanguageSwitcher } from "@/components/ui";
import { cn } from "@/lib/cn";

const LINKS = [
  { to: "/", key: "home", end: true },
  { to: "/about", key: "about", end: false },
  { to: "/gallery", key: "gallery", end: false },
  { to: "/documents", key: "registration", end: false },
  { to: "/contact", key: "contact", end: false },
] as const;

/**
 * A navbar that floats as a rounded panel rather than spanning the full
 * width as a flat bar.
 *
 * It gains a stronger shadow once the page scrolls, which separates it
 * from content passing underneath — without that it dissolves into the
 * hero, since both are near-white.
 */
export function SiteNavbar() {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A route change should not leave the mobile panel hanging open.
  useEffect(() => {
    if (!isMenuOpen) return;
    const close = () => setIsMenuOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-40 pt-3 sm:pt-4">
      <Container size="wide">
        <div
          className={cn(
            "rounded-panel bg-shell/95 backdrop-blur transition-shadow duration-300",
            isScrolled ? "shadow-lifted" : "shadow-soft",
          )}
        >
          <div className="flex h-16 items-center justify-between gap-2 px-3 sm:h-[4.5rem] sm:gap-3 sm:px-6">
            <Link to="/" className="shrink-0" aria-label={t("nav.homeAria")}>
              <Wordmark variant="compact" />
            </Link>

            <nav aria-label={t("nav.main")} className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.end}
                      className={({ isActive }) =>
                        cn(
                          "rounded-pill px-3.5 py-2 text-sm font-semibold transition-colors",
                          isActive
                            ? "text-primary-600"
                            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )
                      }
                    >
                      {t(`nav.${link.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              {/* Visible at every width, including mobile: someone who
                  reads only Arabic must not have to open a menu to find
                  out the site speaks their language. */}
              <LanguageSwitcher />

              <Link
                to="/parent/login"
                className="hidden h-10 items-center gap-2 rounded-pill bg-primary-600 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-700 md:inline-flex"
              >
                <UserRound aria-hidden="true" className="size-4" />
                {t("nav.parentPortal")}
              </Link>
              <Link
                to="/contact"
                className="hidden h-10 items-center gap-2 rounded-pill bg-secondary-600 px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-secondary-700 lg:inline-flex"
              >
                <Phone aria-hidden="true" className="size-4" />
                {t("nav.contactUs")}
              </Link>

              <button
                type="button"
                className="rounded-pill p-2 text-ink-600 hover:bg-ink-50 lg:hidden"
                aria-expanded={isMenuOpen}
                aria-controls="site-menu"
                aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                {isMenuOpen ? (
                  <X aria-hidden="true" className="size-5" />
                ) : (
                  <Menu aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <nav
              id="site-menu"
              aria-label={t("nav.mobile")}
              className="border-t border-ink-100 px-4 pb-4 pt-2 lg:hidden"
            >
              <ul className="flex flex-col gap-1">
                {LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.end}
                      onClick={() => setIsMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "block rounded-card px-3 py-2.5 text-sm font-semibold",
                          isActive
                            ? "bg-primary-50 text-primary-700"
                            : "text-ink-600 hover:bg-ink-50",
                        )
                      }
                    >
                      {t(`nav.${link.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/parent/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-primary-600 px-4 text-sm font-bold text-white md:hidden"
                >
                  <UserRound aria-hidden="true" className="size-4" />
                  {t("nav.parentPortal")}
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-secondary-600 px-4 text-sm font-bold text-white"
                >
                  <Phone aria-hidden="true" className="size-4" />
                  {t("nav.contactUs")}
                </Link>
              </div>
            </nav>
          )}
        </div>
      </Container>
    </header>
  );
}
