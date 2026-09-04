export type TimelineEventType =
  | "MEAL"
  | "BOTTLE"
  | "SLEEP"
  | "DIAPER"
  | "TOILET"
  | "TEMPERATURE"
  | "MOOD"
  | "NOTE"
  | "ACTIVITY"
  | "MESSAGE";

export type EventGroup =
  | "meals"
  | "sleep"
  | "activities"
  | "health"
  | "hygiene"
  | "other";

export interface EventAuthor {
  id: string;
  first_name: string;
  last_name: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  label: string;
  icon: string;
  group: EventGroup;
  occurred_at: string;
  ended_at: string | null;
  local_date: string;
  /** Computed server-side from occurred_at/ended_at — never stored. */
  duration_minutes: number | null;
  is_open_interval: boolean;
  title: string;
  description: string;
  data: Record<string, unknown>;
  activity: { id: string; title: string; category: string } | null;
  is_published: boolean;
  created_by: EventAuthor | null;
  created_at: string;
}

export interface TimelineResponse {
  date: string | null;
  child: { id: string; first_name: string; last_name: string };
  count: number;
  results: TimelineEvent[];
}

export interface EventTypeSpec {
  key: TimelineEventType;
  label: string;
  icon: string;
  group: EventGroup;
  interval: boolean;
  staff_creatable: boolean;
  quick_add: boolean;
}

export interface EventTypeRegistry {
  types: EventTypeSpec[];
  filters: { key: EventGroup; label: string; types: TimelineEventType[] }[];
}

export interface CreateEventInput {
  type: TimelineEventType;
  occurred_at: string;
  ended_at?: string | null;
  title?: string;
  description?: string;
  data?: Record<string, unknown>;
}

export type TimelineFilter = "all" | EventGroup;

export interface DailySummary {
  feeding: {
    meals: number;
    bottles: number;
    total_ml: number;
    details: {
      meal: string | null;
      label: string;
      eaten: string | null;
      eaten_label: string | null;
      occurred_at: string;
    }[];
  };
  sleep: {
    naps: number;
    total_minutes: number;
    total_display: string;
    in_progress: boolean;
  };
  health: {
    temperature_count: number;
    last_temperature: string | null;
    last_temperature_at: string | null;
  };
  hygiene: {
    diaper_changes: number;
    toilet_visits: number;
    toilet_successes: number;
  };
  mood: {
    observations: number;
    latest: string | null;
    latest_label: string | null;
  };
  notes: number;
  event_count: number;
}

export interface DailyRecord {
  id: string | null;
  child: { id: string; first_name: string; last_name: string };
  date: string;
  general_notes: string;
  status: "DRAFT" | "PUBLISHED";
  published_at: string | null;
  summary: DailySummary;
}
