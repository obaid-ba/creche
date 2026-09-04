import { apiClient } from "@/services/client";

import type {
  CreateEventInput,
  DailyRecord,
  EventTypeRegistry,
  TimelineEvent,
  TimelineFilter,
  TimelineResponse,
} from "./types";

export interface TimelineParams {
  date?: string;
  from?: string;
  to?: string;
  filter?: TimelineFilter;
  types?: string;
}

export const timelineApi = {
  async list(childId: string, params: TimelineParams): Promise<TimelineResponse> {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      // "all" is the absence of a filter, not a value to send.
      if (value !== undefined && value !== "" && value !== "all") {
        query[key] = value;
      }
    }
    const { data } = await apiClient.get<TimelineResponse>(
      `/children/${childId}/timeline/`,
      { params: query },
    );
    return data;
  },

  async create(childId: string, input: CreateEventInput): Promise<TimelineEvent> {
    const { data } = await apiClient.post<TimelineEvent>(
      `/children/${childId}/timeline/`,
      input,
    );
    return data;
  },

  async update(
    eventId: string,
    input: Partial<CreateEventInput>,
  ): Promise<TimelineEvent> {
    const { data } = await apiClient.patch<TimelineEvent>(
      `/timeline-events/${eventId}/`,
      input,
    );
    return data;
  },

  async remove(eventId: string): Promise<void> {
    await apiClient.delete(`/timeline-events/${eventId}/`);
  },

  /** Close an open interval — the "Fin sieste" tap. */
  async end(eventId: string, endedAt?: string): Promise<TimelineEvent> {
    const { data } = await apiClient.post<TimelineEvent>(
      `/timeline-events/${eventId}/end/`,
      endedAt !== undefined ? { ended_at: endedAt } : {},
    );
    return data;
  },

  async eventTypes(): Promise<EventTypeRegistry> {
    const { data } = await apiClient.get<EventTypeRegistry>(
      "/timeline/event-types/",
    );
    return data;
  },

  async dailyRecord(childId: string, date?: string): Promise<DailyRecord> {
    const { data } = await apiClient.get<DailyRecord>(
      `/children/${childId}/daily-record/`,
      { params: date !== undefined ? { date } : {} },
    );
    return data;
  },

  async saveNotes(
    childId: string,
    date: string,
    generalNotes: string,
  ): Promise<DailyRecord> {
    const { data } = await apiClient.put<DailyRecord>(
      `/children/${childId}/daily-record/`,
      { general_notes: generalNotes },
      { params: { date } },
    );
    return data;
  },

  async publish(childId: string, date: string): Promise<DailyRecord> {
    const { data } = await apiClient.post<DailyRecord>(
      `/children/${childId}/daily-record/publish/`,
      {},
      { params: { date } },
    );
    return data;
  },
};
