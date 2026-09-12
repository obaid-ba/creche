import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n/config";

import { describeDate, todayISO } from "../components/DateSelector";
import { eventDetail, formatDuration } from "../eventDisplay";
import type { TimelineEvent } from "../types";

/**
 * The Arabic side of the timeline.
 *
 * These helpers read the active language from the i18next instance
 * rather than taking it as an argument, which is exactly the kind of
 * implicit dependency that stops working silently. They are also where
 * Arabic's plural categories actually bite: a nap of two hours is
 * "ساعتان", a dual form, and a French-shaped singular/plural pair has
 * nowhere to put it.
 */

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "1",
    type: "MOOD",
    label: "",
    icon: "smile",
    group: "health",
    occurred_at: "2026-09-12T10:30:00Z",
    ended_at: null,
    duration_minutes: null,
    is_open_interval: false,
    description: "",
    data: {},
    activity: null,
    message: null,
    ...overrides,
  } as TimelineEvent;
}

afterEach(async () => {
  await i18n.changeLanguage("fr");
});

describe("timeline helpers in Arabic", () => {
  it("translates payload enums", async () => {
    await i18n.changeLanguage("ar");

    expect(eventDetail(makeEvent({ data: { mood: "HAPPY" } }))).toBe("سعيد");
    expect(
      eventDetail(makeEvent({ type: "DIAPER", data: { state: "WET" } })),
    ).toBe("مبلل");
    expect(
      eventDetail(
        makeEvent({ type: "MEAL", data: { meal: "LUNCH", eaten: "ALL" } }),
      ),
    ).toBe("الغداء · أكل كل شيء");
  });

  it("uses the dual form for two hours and two minutes", async () => {
    await i18n.changeLanguage("ar");

    expect(formatDuration(120)).toBe("ساعتان");
    expect(formatDuration(2)).toBe("دقيقتان");
    // 3-10 is the "few" category, 11-99 the "many" one.
    expect(formatDuration(5)).toBe("5 دقائق");
    expect(formatDuration(45)).toBe("45 دقيقة");
  });

  it("keeps a temperature in Latin digits and Latin order", async () => {
    await i18n.changeLanguage("ar");

    // Reversing this to "C° 6,36" is what happens without an explicit
    // format; a measurement is not prose.
    expect(
      eventDetail(makeEvent({ type: "TEMPERATURE", data: { celsius: "36.6" } })),
    ).toBe("36,6 °C");
  });

  it("names today and yesterday in the active language", async () => {
    expect(describeDate(todayISO())).toBe("Aujourd'hui");

    await i18n.changeLanguage("ar");
    expect(describeDate(todayISO())).toBe("اليوم");
  });

  it("writes an older date with Tunisian month names", async () => {
    await i18n.changeLanguage("ar");

    // ar-TN, not ar: Tunisia says جانفي where the Levant says يناير, and
    // it keeps Western digits where ar-EG would use ٠١٢.
    expect(describeDate("2026-01-15")).toContain("جانفي");
    expect(describeDate("2026-01-15")).toContain("15");
  });

  it("falls back to the description rather than printing a key", async () => {
    await i18n.changeLanguage("ar");

    const event = makeEvent({
      data: { mood: "NOT_A_MOOD" },
      description: "ملاحظة حرة",
    });
    expect(eventDetail(event)).toBe("ملاحظة حرة");
  });
});
