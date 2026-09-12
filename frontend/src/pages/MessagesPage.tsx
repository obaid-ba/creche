import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/app";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { MessageComposer } from "@/features/messages/components/MessageComposer";
import { MessageThread } from "@/features/messages/components/MessageThread";
import {
  useConversations,
  useMarkRead,
  useSendMessage,
  useThread,
} from "@/features/messages/hooks";
import { cn } from "@/lib/cn";

/** Shared by both roles: the participants differ, the screen does not. */
export function MessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const thread = useThread(selectedId ?? undefined);
  const sendMessage = useSendMessage(selectedId ?? "");
  const markRead = useMarkRead();

  // Select the first conversation once the list arrives.
  const first = conversations.data?.results[0]?.id;
  useEffect(() => {
    if (selectedId === null && first !== undefined) setSelectedId(first);
  }, [first, selectedId]);

  // Opening a conversation clears its unread badge.
  useEffect(() => {
    if (selectedId !== null) markRead.mutate(selectedId);
    // markRead is stable enough for this effect's purpose; re-running on
    // every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The server rejects a blocked parent with a 403 regardless; this only
  // lets the UI explain why instead of failing after they have typed.
  const canSend = user?.can_send_messages ?? false;

  return (
    <PageShell size="wide">
      <h1 className="mb-6 font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("messages.title")}
      </h1>

      {conversations.isPending ? (
        <LoadingState label={t("messages.loading")} />
      ) : conversations.isError ? (
        <ErrorState
          description={t("messages.loadError")}
          onRetry={() => void conversations.refetch()}
        />
      ) : conversations.data.results.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title={t("messages.empty")}
          description={t("messages.emptyHint")}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit">
            <CardHeader title={t("messages.conversations")} />
            <ul className="divide-y divide-ink-100">
              {conversations.data.results.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    aria-current={selectedId === conversation.id}
                    className={cn(
                      "w-full px-4 py-3 text-start transition-colors",
                      selectedId === conversation.id
                        ? "bg-primary-50"
                        : "hover:bg-ink-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-ink-900">
                        {conversation.child.first_name}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-600 text-[0.65rem] font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    {conversation.last_message !== null && (
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {conversation.last_message.body}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              {thread.isPending ? (
                <LoadingState label={t("common.loading")} />
              ) : thread.isError ? (
                <ErrorState description={t("messages.threadError")} />
              ) : (
                <MessageThread messages={thread.data.results} />
              )}

              {selectedId !== null && (
                <MessageComposer
                  isPending={sendMessage.isPending}
                  onSend={(body) => sendMessage.mutateAsync(body)}
                  {...(canSend
                    ? {}
                    : {
                        disabledReason:
                          t("messages.sendingDisabled"),
                      })}
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
