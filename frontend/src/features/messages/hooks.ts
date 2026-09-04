import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { messagesApi } from "./api";

export const messageKeys = {
  all: ["messages"] as const,
  conversations: () => [...messageKeys.all, "conversations"] as const,
  thread: (id: string) => [...messageKeys.all, "thread", id] as const,
  unread: () => [...messageKeys.all, "unread"] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: () => messagesApi.conversations(),
  });
}

export function useThread(conversationId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.thread(conversationId ?? ""),
    queryFn: () => messagesApi.messages(conversationId as string),
    enabled: conversationId !== undefined && conversationId !== "",
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: messageKeys.unread(),
    queryFn: () => messagesApi.unreadCount(),
    // The badge should feel live without a socket.
    refetchInterval: 60_000,
  });
}

function useMessageInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: messageKeys.all });
}

export function useSendMessage(conversationId: string) {
  const invalidate = useMessageInvalidation();
  return useMutation({
    mutationFn: (body: string) => messagesApi.send(conversationId, body),
    onSuccess: invalidate,
  });
}

export function useStartConversation() {
  const invalidate = useMessageInvalidation();
  return useMutation({
    mutationFn: (input: { child_id: string; subject?: string; body: string }) =>
      messagesApi.start(input),
    onSuccess: invalidate,
  });
}

export function useMarkRead() {
  const invalidate = useMessageInvalidation();
  return useMutation({
    mutationFn: (conversationId: string) => messagesApi.markRead(conversationId),
    onSuccess: invalidate,
  });
}
