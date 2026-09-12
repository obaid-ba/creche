import { FileText, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Container } from "@/components/ui";
import { NURSERY } from "@/config/nursery";

/**
 * The closing call to action, on a coral band with a wave along its top
 * edge — the one place the brand colour fills a whole section, which is
 * what makes it read as the end of the page.
 */
export function RegistrationCta() {
  const { t } = useTranslation();

  return (
    <section className="relative mt-10 pt-10">
      {/* The wave is decorative; it sits above the band and bleeds full
          width regardless of the container's measure. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-14 w-full text-primary-400"
      >
        <path
          d="M0 62C160 92 320 92 480 68S800 18 960 26s320 44 480 44v20H0V62Z"
          fill="currentColor"
        />
      </svg>

      <div className="bg-primary-400 pb-10 pt-4">
        <Container size="wide">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-start">
            <h2 className="text-xl text-secondary-900 md:text-2xl">
              {t("cta.title")}
            </h2>

            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={NURSERY.registrationDocument}
                download
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-shell px-5 text-sm font-bold text-ink-800 shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <FileText aria-hidden="true" className="size-4 text-secondary-600" />
                {t("cta.registration")}
              </a>

              <Link
                to="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-accent-300 px-5 text-sm font-bold text-ink-900 shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <Phone aria-hidden="true" className="size-4" />
                {t("cta.contact")}
              </Link>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
