import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "./api";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly: boolean) =>
    [...notificationKeys.all, "list", unreadOnly] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => notificationsApi.list(unreadOnly),
  });
}

export function useNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationsApi.unreadCount(),
    // Polling keeps the badge current without a websocket. A minute is
    // frequent enough for nursery updates and cheap enough to leave on.
    refetchInterval: 60_000,
  });
}

function useNotificationInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useMarkNotificationRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}
