import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

import type {
  Activity,
  ActivityListParams,
  ActivityPhoto,
  ActivityWriteInput,
} from "./types";

function clean(params: ActivityListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value as string | number;
    }
  }
  return out;
}

export const activitiesApi = {
  async list(params: ActivityListParams): Promise<PageResponse<Activity>> {
    const { data } = await apiClient.get<PageResponse<Activity>>("/activities/", {
      params: clean(params),
    });
    return data;
  },

  async get(id: string): Promise<Activity> {
    const { data } = await apiClient.get<Activity>(`/activities/${id}/`);
    return data;
  },

  async create(input: ActivityWriteInput): Promise<Activity> {
    const { data } = await apiClient.post<Activity>("/activities/", input);
    return data;
  },

  async update(id: string, input: Partial<ActivityWriteInput>): Promise<Activity> {
    const { data } = await apiClient.patch<Activity>(`/activities/${id}/`, input);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/activities/${id}/`);
  },

  /** Creates one ACTIVITY timeline event per child, server-side. */
  async addParticipants(id: string, childIds: string[]): Promise<Activity> {
    const { data } = await apiClient.post<Activity>(
      `/activities/${id}/participants/`,
      { child_ids: childIds },
    );
    return data;
  },

  async removeParticipant(id: string, childId: string): Promise<void> {
    await apiClient.delete(`/activities/${id}/participants/${childId}/`);
  },

  async uploadPhoto(
    id: string,
    file: File,
    caption?: string,
  ): Promise<ActivityPhoto> {
    const form = new FormData();
    form.append("image", file);
    if (caption !== undefined && caption !== "") form.append("caption", caption);

    // The request interceptor drops the JSON Content-Type for FormData so
    // the browser can set the multipart boundary.
    const { data } = await apiClient.post<ActivityPhoto>(
      `/activities/${id}/photos/`,
      form,
    );
    return data;
  },

  async removePhoto(id: string, photoId: string): Promise<void> {
    await apiClient.delete(`/activities/${id}/photos/${photoId}/`);
  },
};
