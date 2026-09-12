import { useDirection } from "./useDirection";

/**
 * The BCP-47 tag to hand to `Intl` and the `toLocale*` methods.
 *
 * Dates were formatted with a hard-coded "fr-FR" in a dozen places, which
 * printed "12 septembre" in the middle of an otherwise Arabic page. The
 * region matters as well as the language: "ar-TN" gives Tunisian month
 * names (جانفي, فيفري) rather than the Levantine ones "ar" alone
 * produces, and those are the names parents here actually use.
 */
const TAGS = { fr: "fr-FR", ar: "ar-TN" } as const;

export function useLocale(): string {
  const { language } = useDirection();
  return TAGS[language];
}
