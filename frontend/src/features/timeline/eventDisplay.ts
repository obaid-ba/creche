import type { TimelineEvent } from "./types";

/**
 * Presentation helpers for one event.
 *
 * Kept out of the components so the display rules are testable on their
 * own and shared between the parent and staff views (brief 24).
 */

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

const MOOD_LABELS: Record<string, string> = {
  HAPPY: "Joyeux",
  CALM: "Calme",
  TIRED: "Fatigué",
  SAD: "Triste",
  IRRITATED: "Irrité",
  ACTIVE: "Actif",
  OTHER: "Autre",
};

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Petit déjeuner",
  LUNCH: "Déjeuner",
  SNACK: "Goûter",
  DINNER: "Dîner",
};

const EATEN_LABELS: Record<string, string> = {
  ALL: "Tout mangé",
  MOST: "Presque tout",
  SOME: "Un peu",
  NONE: "Rien mangé",
};

const DIAPER_LABELS: Record<string, string> = {
  WET: "Mouillé",
  SOILED: "Sale",
  BOTH: "Mouillé et sale",
  DRY: "Sec",
};

export function eventEmoji(type: string): string {
  return EMOJI[type] ?? "•";
}

/** HH:MM in the viewer's locale. */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 75 → "1h15", matching the backend's French formatting. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
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
      return typeof volume === "number" ? `${volume} ml` : event.description;
    }

    case "MEAL": {
      const meal = MEAL_LABELS[String(data["meal"])] ?? "";
      const eaten = EATEN_LABELS[String(data["eaten"])] ?? "";
      return [meal, eaten].filter(Boolean).join(" · ") || event.description;
    }

    case "SLEEP": {
      if (event.is_open_interval) return "En cours…";
      return event.duration_minutes !== null
        ? `Durée : ${formatDuration(event.duration_minutes)}`
        : event.description;
    }

    case "TEMPERATURE": {
      const celsius = data["celsius"];
      return celsius !== undefined && celsius !== null
        ? `${String(celsius).replace(".", ",")} °C`
        : event.description;
    }

    case "MOOD": {
      const mood = MOOD_LABELS[String(data["mood"])] ?? "";
      const note = typeof data["note"] === "string" ? data["note"] : "";
      return [mood, note].filter(Boolean).join(" · ") || event.description;
    }

    case "DIAPER":
      return DIAPER_LABELS[String(data["state"])] ?? event.description;

    case "TOILET":
      return data["success"] === true ? "Réussi" : "Sans résultat";

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
