/**
 * Guardian relationships, in one place.
 *
 * The same four-entry map had been copied into four components, in two
 * different shapes — an array for the pickers, a record for the labels —
 * so adding a fifth relationship meant finding all four and getting both
 * shapes right.
 *
 * Values are the API's stored enum and must not be translated; only the
 * wording is.
 */
export const RELATIONSHIPS = [
  { value: "MOTHER", key: "form.mother" },
  { value: "FATHER", key: "form.father" },
  { value: "GUARDIAN", key: "form.guardian" },
  { value: "OTHER", key: "form.other" },
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number]["value"];

/** Translation key for a stored value, or `undefined` for one we do not
 *  know — callers fall back to showing the raw value rather than a gap. */
export function relationshipKey(value: string): string | undefined {
  return RELATIONSHIPS.find((r) => r.value === value)?.key;
}

/** Options for a `<Select>`, already translated. */
export function relationshipOptions(t: (key: string) => string) {
  return RELATIONSHIPS.map((r) => ({ value: r.value, label: t(r.key) }));
}
