import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from "./config";

export function currentLanguage(code: string): Language {
  const base = code.split("-")[0] ?? DEFAULT_LANGUAGE;
  return base in LANGUAGES ? (base as Language) : DEFAULT_LANGUAGE;
}

/**
 * Keeps `<html lang>` and `<html dir>` in step with the active language.
 *
 * Both matter beyond layout: `lang` tells a screen reader which voice to
 * use — French copy read by an Arabic voice is unintelligible — and
 * `dir` drives every logical CSS property, so the whole interface
 * mirrors from one attribute rather than from per-component overrides.
 */
export function useDirection(): {
  language: Language;
  dir: "ltr" | "rtl";
  setLanguage: (next: Language) => void;
} {
  const { i18n } = useTranslation();
  const language = currentLanguage(i18n.language);
  const dir = LANGUAGES[language].dir;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = dir;
  }, [language, dir]);

  return {
    language,
    dir,
    setLanguage: (next: Language) => void i18n.changeLanguage(next),
  };
}
