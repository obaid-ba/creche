import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteNavbar } from "@/components/public/SiteNavbar";

export function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {/* Lets keyboard and screen-reader users skip the navigation on
          every page rather than tabbing through it each time. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>

      <SiteNavbar />

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
