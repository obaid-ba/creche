/**
 * Formatting money, and the one place that parses it.
 *
 * The dinar has three decimal places (1 TND = 1000 millimes), which
 * `Intl.NumberFormat` already knows for the TND currency — so the digit
 * count comes from the locale data rather than being hardcoded.
 *
 * Amounts are strings everywhere else in this feature; see types.ts.
 */
const CURRENCY = "TND";

export function formatMoney(amount: string, locale: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
  }).format(value);
}

/** The month a period belongs to, e.g. "octobre 2026" / "أكتوبر 2026". */
export function formatPeriod(period: string, locale: string): string {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Validates an amount typed by a human.
 *
 * Returns the normalised string, or null if it is not a usable amount.
 * Accepts a comma as the decimal separator, because a French or Arabic
 * keyboard produces one and rejecting it would read as a broken field.
 * Rejects more than three decimals rather than rounding: silently turning
 * 10,5555 into 10,556 on a financial record is worse than saying no.
 */
export function parseAmount(raw: string): string | null {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(3);
}

/** True when the balance owes nothing (zero, or overpaid). */
export function isSettled(balance: string): boolean {
  const value = Number(balance);
  return Number.isFinite(value) && value <= 0;
}
