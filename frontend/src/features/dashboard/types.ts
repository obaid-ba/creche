import type { AgeGroup, AgeGroupKey } from "@/types/api";
import type { DailySummary } from "@/features/timeline/types";

export interface ParentDashboardChild {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  age_display: string;
  age_group: AgeGroup;
  day_published: boolean;
  general_notes: string;
  summary: DailySummary;
  latest_events: {
    id: string;
    type: string;
    occurred_at: string;
    description: string;
    data: Record<string, unknown>;
  }[];
}

export interface ParentDashboard {
  children: ParentDashboardChild[];
  unread_messages: number;
  unread_notifications: number;
  open_complaints: number;
}

export interface StaffDashboard {
  total_children: number;
  age_groups: { key: AgeGroupKey; label: string; count: number }[];
  new_complaints: number;
  in_progress_complaints: number;
  unread_messages: number;
  days_published_today: number;
  children_with_events_today: number;
  recent_activities: {
    id: string;
    title: string;
    date: string;
    category: string;
    participant_count: number;
  }[];
}
