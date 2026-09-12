import { useTranslation } from "react-i18next";

/**
 * Resolves a form field's error message.
 *
 * Two kinds of message end up in the same place. Zod schemas are module
 * constants evaluated once at import, so they cannot hold translated
 * text — they carry translation keys instead, resolved here at render so
 * they follow a language switch. The API sends real sentences, already
 * in the request's language, which must pass through untouched.
 *
 * `defaultValue` covers both: a key that exists is translated, and
 * anything else is returned as it came.
 */
export function useFieldError(): (message?: string) => string | undefined {
  const { t } = useTranslation();

  return (message?: string) =>
    message === undefined || message === ""
      ? undefined
      : t(message, { defaultValue: message });
}
