import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";

import { AppSidebar } from "@/components/app/AppSidebar";
import { Wordmark } from "@/components/brand/Wordmark";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";

/**
 * Shell shared by the parent and staff spaces.
 *
 * The rail is always mounted at `lg` and above and collapses to a
 * slide-over below it. Both render the same `AppSidebar`, so there is
 * one navigation to keep correct rather than a desktop copy and a mobile
 * copy that drift.
 */
export function AppLayout({ area }: { area: "parent" | "staff" }) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Following a link inside the slide-over should close it; without this
  // the new page renders underneath a panel that is still covering it.
  useEffect(() => setIsMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  return (
    <div className="min-h-screen bg-cream">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>

      {/* ── Rail, from lg up ──────────────────────────────────────── */}
      <div className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-ink-100 lg:block">
        <AppSidebar area={area} withBell />
      </div>

      {/* ── Slide-over, below lg ──────────────────────────────────── */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t("app.close")}
            onClick={() => setIsMenuOpen(false)}
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85vw] shadow-float">
            <AppSidebar area={area} onNavigate={() => setIsMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:ms-64">
        {/* ── Top bar, below lg only ──────────────────────────────── */}
        {/* At lg the rail already carries the brand, the bell and the
            account block, so a second bar would be an empty strip. */}
        <header className="sticky top-0 z-20 border-b border-ink-100 bg-cream/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? t("app.close") : t("app.open")}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-pill p-2 text-ink-600 hover:bg-ink-100"
            >
              {isMenuOpen ? (
                <X aria-hidden="true" className="size-5" />
              ) : (
                <Menu aria-hidden="true" className="size-5" />
              )}
            </button>

            <Wordmark variant="compact" />

            <div className="ms-auto flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>

        <main id="contenu" className="pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
