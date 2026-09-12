export type ActivityCategory =
  | "ART" | "MUSIC" | "OUTDOOR" | "STORY" | "MOTOR" | "EDUCATIONAL" | "OTHER";

export interface ActivityPhoto {
  id: string;
  image_url: string | null;
  thumbnail_url: string | null;
  caption: string;
  order: number;
}

export interface ActivityParticipant {
  id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  note: string;
}

/** Staff shape. Parents get a reduced version without participant names. */
export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  category: ActivityCategory;
  category_label: string;
  photos: ActivityPhoto[];
  participants?: ActivityParticipant[];
  participant_count: number;
  created_at: string;
  updated_at?: string;
}

export interface ActivityWriteInput {
  title: string;
  description?: string | undefined;
  date: string;
  start_time?: string | null | undefined;
  end_time?: string | null | undefined;
  category?: ActivityCategory | undefined;
}

export interface ActivityListParams {
  date?: string;
  from?: string;
  to?: string;
  category?: string;
  child?: string;
  page?: number;
}

/** Translation keys; the API also sends `category_label` translated, but
 *  a filter dropdown has to list categories no loaded activity has. */
export const CATEGORY_KEYS: Record<ActivityCategory, string> = {
  ART: "activities.cat.ART",
  MUSIC: "activities.cat.MUSIC",
  OUTDOOR: "activities.cat.OUTDOOR",
  STORY: "activities.cat.STORY",
  MOTOR: "activities.cat.MOTOR",
  EDUCATIONAL: "activities.cat.EDUCATIONAL",
  OTHER: "activities.cat.OTHER",
};
