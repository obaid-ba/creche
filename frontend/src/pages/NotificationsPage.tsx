import { Bell, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PageShell } from "@/components/app";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Tabs,
} from "@/components/ui";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationCount,
  useNotifications,
} from "@/features/notifications/hooks";
import { NOTIFICATION_ICONS } from "@/features/notifications/types";
import { cn } from "@/lib/cn";
import { useState } from "react";

/** Full history behind the bell (brief §16). Shared by both roles. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const query = useNotifications(tab === "unread");
  const count = useNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.results ?? [];
  const unread = count.data ?? 0;

  return (
    <PageShell size="form">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
            {t("notifications.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {unread === 0
              ? t("notifications.allRead")
              : t("notifications.unread", { count: unread })}
          </p>
        </div>

        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Check className="size-4" />}
            isLoading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      <Tabs
        label={t("notifications.filter")}
        value={tab}
        onChange={(key) => setTab(key as "all" | "unread")}
        items={[
          { key: "all", label: t("notifications.all") },
          { key: "unread", label: t("notifications.unreadTab"), count: unread },
        ]}
      />

      <div className="mt-5">
        {query.isPending ? (
          <LoadingState label={t("common.loading")} />
        ) : query.isError ? (
          <ErrorState
            description={t("notifications.loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title={t(
              tab === "unread"
                ? "notifications.emptyUnread"
                : "notifications.empty",
            )}
            description={t("notifications.emptyHint")}
          />
        ) : (
          <Card>
            <ul className="divide-y divide-ink-100">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.is_read) markRead.mutate(item.id);
                      if (item.link !== "") navigate(item.link);
                    }}
                    className={cn(
                      "flex w-full gap-3 px-5 py-4 text-start transition-colors hover:bg-ink-50",
                      !item.is_read && "bg-primary-50/60",
                    )}
                  >
                    <span aria-hidden="true" className="text-xl">
                      {NOTIFICATION_ICONS[item.type] ?? "🔔"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink-900">
                        {item.title}
                      </span>
                      {item.body !== "" && (
                        <span className="mt-0.5 block text-sm text-ink-600">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-ink-400">
                        {new Date(item.created_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    {!item.is_read && (
                      <span
                        aria-label="Non lue"
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
