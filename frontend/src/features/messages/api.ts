import { apiClient } from "@/services/client";
import type { CursorResponse, PageResponse } from "@/types/api";

import type { Conversation, Message } from "./types";

export const messagesApi = {
  async conversations(): Promise<PageResponse<Conversation>> {
    const { data } = await apiClient.get<PageResponse<Conversation>>(
      "/conversations/",
    );
    return data;
  },

  async messages(conversationId: string): Promise<CursorResponse<Message>> {
    const { data } = await apiClient.get<CursorResponse<Message>>(
      `/conversations/${conversationId}/messages/`,
    );
    return data;
  },

  async send(conversationId: string, body: string): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      `/conversations/${conversationId}/messages/`,
      { body },
    );
    return data;
  },

  async start(input: {
    child_id: string;
    subject?: string;
    body: string;
  }): Promise<Conversation> {
    const { data } = await apiClient.post<Conversation>("/conversations/", input);
    return data;
  },

  async markRead(conversationId: string): Promise<void> {
    await apiClient.post(`/conversations/${conversationId}/read/`);
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ unread: number }>(
      "/messages/unread-count/",
    );
    return data.unread;
  },
};
