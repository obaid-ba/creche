import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LANGUAGES, type Language } from "@/i18n/config";
import { useDirection } from "@/i18n/useDirection";
import { cn } from "@/lib/cn";

/**
 * A two-way language toggle.
 *
 * With exactly two languages a segmented control beats a dropdown: the
 * alternative is always visible, so switching is one tap and nobody has
 * to open a menu to discover the site speaks their language. Each option
 * is labelled in its own script, because someone who reads only Arabic
 * cannot be expected to find "Arabe" written in French.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useDirection();

  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill bg-ink-50 p-0.5",
        className,
      )}
    >
      <Languages
        aria-hidden="true"
        className="ms-2 me-0.5 size-3.5 shrink-0 text-ink-400"
      />
      {(Object.keys(LANGUAGES) as Language[]).map((code) => {
        const isActive = code === language;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={isActive}
            aria-label={t("language.switchTo", {
              language: LANGUAGES[code].native,
            })}
            onClick={() => setLanguage(code)}
            className={cn(
              "rounded-pill px-2.5 py-1 text-xs font-bold transition-colors",
              isActive
                ? "bg-shell text-primary-700 shadow-soft"
                : "text-ink-500 hover:text-ink-800",
            )}
          >
            {code === "ar" ? "ع" : "FR"}
          </button>
        );
      })}
    </div>
  );
}
