import { describe, expect, it } from "vitest";

import ar from "../locales/ar.json";
import fr from "../locales/fr.json";

/**
 * Locale files rot quietly: a key added to French and forgotten in
 * Arabic falls back to the French string, so the page still renders and
 * nothing fails — an Arabic reader just gets a sentence of French in the
 * middle of the page. These assertions are the only thing that notices.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const frKeys = flatten(fr as Tree);
const arKeys = flatten(ar as Tree);

/** i18next appends a CLDR plural category; Arabic has six, French two. */
const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, "");

describe("locale files", () => {
  it("translates every French key into Arabic", () => {
    const arBases = new Set([...arKeys.keys()].map(base));
    const missing = [...frKeys.keys()]
      .map(base)
      .filter((key) => !arBases.has(key));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("carries no Arabic key that French does not define", () => {
    const frBases = new Set([...frKeys.keys()].map(base));
    const extra = [...arKeys.keys()].map(base).filter((key) => !frBases.has(key));
    expect([...new Set(extra)]).toEqual([]);
  });

  it("keeps the same interpolation placeholders on both sides", () => {
    // `count` is exempt inside a plural form: Arabic says "طفل واحد"
    // where French says "1 enfant", and spelling the number out is the
    // correct singular, not a dropped placeholder.
    const placeholders = (value: string, key: string) =>
      [...value.matchAll(/\{\{(\w+)\}\}/g)]
        .map((m) => m[1])
        .filter((name) => !(PLURAL.test(key) && name === "count"))
        .sort();

    const mismatched: string[] = [];
    for (const [key, value] of frKeys) {
      const arValue = arKeys.get(key);
      if (arValue === undefined) continue;
      if (placeholders(value, key).join() !== placeholders(arValue, key).join()) {
        mismatched.push(key);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("gives Arabic every plural form it needs", () => {
    // A count-bearing key must cover all six categories in Arabic; with
    // only one/other, "طفلان" (exactly two) is never reachable.
    const pluralBases = new Set(
      [...arKeys.keys()].filter((k) => PLURAL.test(k)).map(base),
    );
    for (const stem of pluralBases) {
      const forms = [...arKeys.keys()]
        .filter((k) => base(k) === stem)
        .map((k) => k.slice(stem.length + 1))
        .sort();
      expect(forms, stem).toEqual(["few", "many", "one", "other", "two", "zero"]);
    }
  });

  it("leaves no French left untranslated in the Arabic file", () => {
    // Latin letters are legitimate in a few values (PDF, 2026 – 2027),
    // but a run of three or more Latin words is a forgotten string.
    const suspicious = [...arKeys.entries()].filter(([, value]) =>
      /[A-Za-zÀ-ÿ]+\s+[A-Za-zÀ-ÿ]+\s+[A-Za-zÀ-ÿ]+/.test(value),
    );
    expect(suspicious.map(([k]) => k)).toEqual([]);
  });
});
