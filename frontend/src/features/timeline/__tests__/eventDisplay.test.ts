import { describe, expect, it } from "vitest";

import {
  eventDetail,
  eventEmoji,
  formatDuration,
  groupAccent,
} from "../eventDisplay";
import type { TimelineEvent } from "../types";

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "e1",
    type: "BOTTLE",
    label: "Biberon",
    icon: "milk",
    group: "meals",
    occurred_at: "2026-09-04T08:15:00Z",
    ended_at: null,
    local_date: "2026-09-04",
    duration_minutes: null,
    is_open_interval: false,
    title: "",
    description: "",
    data: { volume_ml: 180 },
    activity: null,
    is_published: true,
    created_by: null,
    created_at: "2026-09-04T08:20:00Z",
    ...overrides,
  };
}

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [-10, "0 min"],
    [45, "45 min"],
    [60, "1h"],
    [75, "1h15"],
    [125, "2h05"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it("matches the backend's French formatting for the brief's example", () => {
    // The brief's mock shows "Durée: 1h15" for a 10:30-11:45 nap.
    expect(formatDuration(75)).toBe("1h15");
  });
});

describe("eventDetail", () => {
  it("shows a bottle volume", () => {
    expect(eventDetail(makeEvent({ data: { volume_ml: 180 } }))).toBe("180 ml");
  });

  it("shows a meal with how much was eaten, in French", () => {
    const event = makeEvent({
      type: "MEAL",
      data: { meal: "LUNCH", eaten: "MOST" },
    });
    expect(eventDetail(event)).toBe("Déjeuner · Presque tout");
  });

  it("shows a completed sleep as a duration", () => {
    const event = makeEvent({
      type: "SLEEP",
      duration_minutes: 75,
      is_open_interval: false,
    });
    expect(eventDetail(event)).toBe("Durée : 1h15");
  });

  it("shows an in-progress nap as ongoing rather than a duration", () => {
    const event = makeEvent({
      type: "SLEEP",
      duration_minutes: null,
      is_open_interval: true,
    });
    expect(eventDetail(event)).toBe("En cours…");
  });

  it("formats a temperature with a French decimal comma", () => {
    const event = makeEvent({ type: "TEMPERATURE", data: { celsius: "36.6" } });
    expect(eventDetail(event)).toBe("36,6 °C");
  });

  it("translates a mood", () => {
    const event = makeEvent({ type: "MOOD", data: { mood: "HAPPY" } });
    expect(eventDetail(event)).toBe("Joyeux");
  });

  it("appends a mood note when present", () => {
    const event = makeEvent({
      type: "MOOD",
      data: { mood: "TIRED", note: "après la sieste" },
    });
    expect(eventDetail(event)).toBe("Fatigué · après la sieste");
  });

  it("translates a diaper state", () => {
    const event = makeEvent({ type: "DIAPER", data: { state: "BOTH" } });
    expect(eventDetail(event)).toBe("Mouillé et sale");
  });

  it("reads an activity title from the reference, not a copy", () => {
    const event = makeEvent({
      type: "ACTIVITY",
      data: {},
      activity: { id: "a1", title: "Peinture", category: "ART" },
    });
    expect(eventDetail(event)).toBe("Peinture");
  });

  it("falls back to the description for an unformatted type", () => {
    const event = makeEvent({
      type: "NOTE",
      data: {},
      description: "A bien joué dehors.",
    });
    expect(eventDetail(event)).toBe("A bien joué dehors.");
  });

  it("does not crash on a missing payload value", () => {
    const event = makeEvent({ type: "BOTTLE", data: {}, description: "Biberon" });
    expect(eventDetail(event)).toBe("Biberon");
  });
});

describe("eventEmoji", () => {
  it("matches the brief's timeline mock-up", () => {
    expect(eventEmoji("BOTTLE")).toBe("🍼");
    expect(eventEmoji("SLEEP")).toBe("😴");
    expect(eventEmoji("MEAL")).toBe("🍽️");
    expect(eventEmoji("TEMPERATURE")).toBe("🌡️");
    expect(eventEmoji("ACTIVITY")).toBe("🎨");
  });

  it("falls back for an unknown type rather than rendering nothing", () => {
    expect(eventEmoji("SOMETHING_NEW")).toBe("•");
  });
});

describe("groupAccent", () => {
  it("returns a class for every known group", () => {
    for (const group of ["meals", "sleep", "activities", "health", "hygiene"]) {
      expect(groupAccent(group)).toBeTruthy();
    }
  });

  it("falls back for an unknown group", () => {
    expect(groupAccent("unknown")).toBe(groupAccent("other"));
  });
});
