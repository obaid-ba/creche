import { describe, expect, it } from "vitest";

import { formatMoney, formatPeriod, isSettled, parseAmount } from "../money";

/**
 * The dinar divides into 1000 millimes, so three decimal places are real
 * precision and not noise. Everything here exists because a rounding
 * shortcut on a financial record is a silent, permanent error.
 */
describe("parseAmount", () => {
  it("accepts a plain amount and normalises to millimes", () => {
    expect(parseAmount("180")).toBe("180.000");
    expect(parseAmount("72.5")).toBe("72.500");
    expect(parseAmount("0.001")).toBe("0.001");
  });

  it("accepts a comma, because that is what the keyboard gives", () => {
    // A French or Arabic layout produces "180,500"; rejecting it would
    // read as a broken field rather than as a validation rule.
    expect(parseAmount("180,500")).toBe("180.500");
  });

  it("refuses more than three decimals rather than rounding them away", () => {
    // Silently turning 10.5555 into 10.556 on a ledger is worse than no.
    expect(parseAmount("10.5555")).toBeNull();
  });

  it("refuses zero, negatives and nonsense", () => {
    for (const bad of ["0", "0.000", "-5", "abc", "", "  ", "1.2.3", "1e3"]) {
      expect(parseAmount(bad), `should reject ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseAmount("  180  ")).toBe("180.000");
  });
});

describe("formatMoney", () => {
  it("renders three decimals, which is the locale's own rule for TND", () => {
    // Not hardcoded: Intl knows the dinar has three.
    const out = formatMoney("180.000", "fr-FR");
    expect(out).toMatch(/180[.,\s  ]000/);
  });

  it("keeps a non-numeric string rather than rendering NaN", () => {
    expect(formatMoney("not-money", "fr-FR")).toBe("not-money");
  });

  it("formats in Arabic too", () => {
    expect(formatMoney("180.000", "ar-TN")).toContain("180");
  });
});

describe("formatPeriod", () => {
  it("names the month in French", () => {
    expect(formatPeriod("2026-10-01", "fr-FR")).toMatch(/octobre/i);
  });

  it("names the month in Tunisian Arabic", () => {
    expect(formatPeriod("2026-10-01", "ar-TN")).toMatch(/2026/);
  });

  it("passes an unparseable value through", () => {
    expect(formatPeriod("nope", "fr-FR")).toBe("nope");
  });
});

describe("isSettled", () => {
  it("is true at zero and when overpaid", () => {
    expect(isSettled("0.000")).toBe(true);
    expect(isSettled("-20.000")).toBe(true);
  });

  it("is false while anything is owed, however little", () => {
    expect(isSettled("0.001")).toBe(false);
  });
});
