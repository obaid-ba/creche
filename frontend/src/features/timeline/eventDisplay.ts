import i18n from "@/i18n/config";
import { currentLanguage } from "@/i18n/useDirection";

import type { TimelineEvent } from "./types";

/**
 * Presentation helpers for one event.
 *
 * Kept out of the components so the display rules are testable on their
 * own and shared between the parent and staff views (brief 24).
 *
 * These read the i18next instance directly rather than taking a `t`
 * argument. They are only ever called during a component's render, and
 * react-i18next re-renders every subscriber when the language changes,
 * so the value read here is always the current one — and the call sites
 * stay free of prop drilling through three layers of timeline
 * components.
 */

/** BCP-47 tag for `Intl`; ar-TN keeps Western digits and Tunisian months. */
function locale(): string {
  return currentLanguage(i18n.language) === "ar" ? "ar-TN" : "fr-FR";
}

/** Emoji per type, matching the brief's own timeline mock-up. */
const EMOJI: Record<string, string> = {
  MEAL: "🍽️",
  BOTTLE: "🍼",
  SLEEP: "😴",
  DIAPER: "👶",
  TOILET: "🚽",
  TEMPERATURE: "🌡️",
  MOOD: "😊",
  NOTE: "📝",
  ACTIVITY: "🎨",
  MESSAGE: "💬",
};

/**
 * Payload enums are stored values, so the lookup is by value and only
 * the wording is translated. An unrecognised value yields "" rather than
 * the key itself, which would surface "event.mood.SOMETHING" to a parent.
 */
function enumLabel(group: string, value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  const key = `event.${group}.${value}`;
  const translated = i18n.t(key);
  return translated === key ? "" : translated;
}

export function eventEmoji(type: string): string {
  return EMOJI[type] ?? "•";
}

/** HH:MM in the viewer's locale. */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 75 → "1h15". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return i18n.t("event.minutes", { count: 0 });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return i18n.t("event.minutes", { count: rest });
  if (rest === 0) return i18n.t("event.hours", { count: hours });
  return i18n.t("event.hoursMinutes", {
    hours,
    minutes: String(rest).padStart(2, "0"),
  });
}

/**
 * The one-line detail under an event's title.
 *
 * Falls back to the event's own description, so a type whose payload we
 * do not specifically format still renders something useful.
 */
export function eventDetail(event: TimelineEvent): string {
  const data = event.data ?? {};

  switch (event.type) {
    case "BOTTLE": {
      const volume = data["volume_ml"];
      return typeof volume === "number"
        ? i18n.t("event.millilitres", { count: volume })
        : event.description;
    }

    case "MEAL": {
      const meal = enumLabel("meal", data["meal"]);
      const eaten = enumLabel("eaten", data["eaten"]);
      return [meal, eaten].filter(Boolean).join(" · ") || event.description;
    }

    case "SLEEP": {
      if (event.is_open_interval) return i18n.t("event.inProgress");
      return event.duration_minutes !== null
        ? i18n.t("event.duration", {
            value: formatDuration(event.duration_minutes),
          })
        : event.description;
    }

    case "TEMPERATURE": {
      const celsius = data["celsius"];
      // A temperature is a measurement, not prose: it keeps Latin digits
      // and Latin order in both languages.
      return celsius !== undefined && celsius !== null
        ? `${Number(celsius).toLocaleString("fr-FR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })} °C`
        : event.description;
    }

    case "MOOD": {
      const mood = enumLabel("mood", data["mood"]);
      const note = typeof data["note"] === "string" ? data["note"] : "";
      return [mood, note].filter(Boolean).join(" · ") || event.description;
    }

    case "DIAPER":
      return enumLabel("diaper", data["state"]) || event.description;

    case "TOILET":
      return data["success"] === true
        ? i18n.t("event.toiletSuccess")
        : i18n.t("event.toiletNoResult");

    case "ACTIVITY":
      return event.activity?.title ?? event.description;

    default:
      return event.description;
  }
}

/** Accent colour per filter group, so the feed scans quickly. */
export function groupAccent(group: string): string {
  const accents: Record<string, string> = {
    meals: "bg-accent-100 text-accent-500",
    sleep: "bg-secondary-100 text-secondary-700",
    activities: "bg-primary-100 text-primary-700",
    health: "bg-info-50 text-info-700",
    hygiene: "bg-success-50 text-success-700",
    other: "bg-ink-100 text-ink-600",
  };
  return accents[group] ?? accents["other"] as string;
}
