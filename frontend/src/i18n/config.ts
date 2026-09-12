import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import fr from "./locales/fr.json";

export const LANGUAGES = {
  fr: { label: "Français", native: "Français", dir: "ltr" as const },
  ar: { label: "Arabe", native: "العربية", dir: "rtl" as const },
} as const;

export type Language = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: Language = "fr";

/**
 * Translation setup.
 *
 * i18next rather than a hand-rolled lookup specifically because of
 * Arabic: it has six plural categories (zero, one, two, few, many,
 * other) against French's two, and getting that wrong produces sentences
 * that read as broken to a native speaker. i18next delegates to
 * `Intl.PluralRules`, which knows the CLDR rules for both.
 */
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      ar: { translation: ar },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(LANGUAGES),
    // Arabic is written "ar" here, not "ar-TN": the copy is Modern
    // Standard Arabic, so regional subtags would only fragment the
    // resource files without changing a word.
    load: "languageOnly",
    interpolation: {
      // React escapes for us; doing it twice mangles apostrophes, which
      // French copy is full of.
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "creche-lang",
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export default i18next;
