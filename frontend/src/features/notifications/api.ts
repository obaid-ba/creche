import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

import type { AppNotification } from "./types";

export const notificationsApi = {
  async list(unreadOnly = false): Promise<PageResponse<AppNotification>> {
    const { data } = await apiClient.get<PageResponse<AppNotification>>(
      "/notifications/",
      { params: unreadOnly ? { unread: "true" } : {} },
    );
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ unread: number }>(
      "/notifications/unread-count/",
    );
    return data.unread;
  },

  async markRead(id: string): Promise<AppNotification> {
    const { data } = await apiClient.post<AppNotification>(
      `/notifications/${id}/read/`,
    );
    return data;
  },

  async markAllRead(): Promise<void> {
    await apiClient.post("/notifications/read-all/");
  },
};
