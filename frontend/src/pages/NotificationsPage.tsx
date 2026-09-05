import { Bell, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [tab, setTab] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const query = useNotifications(tab === "unread");
  const count = useNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.results ?? [];
  const unread = count.data ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-ink-500">
            {unread === 0
              ? "Tout est à jour."
              : `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}.`}
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
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <Tabs
        label="Filtrer les notifications"
        value={tab}
        onChange={(key) => setTab(key as "all" | "unread")}
        items={[
          { key: "all", label: "Toutes" },
          { key: "unread", label: "Non lues", count: unread },
        ]}
      />

      <div className="mt-5">
        {query.isPending ? (
          <LoadingState label="Chargement…" />
        ) : query.isError ? (
          <ErrorState
            description="Impossible de charger les notifications."
            onRetry={() => void query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title={tab === "unread" ? "Aucune notification non lue" : "Aucune notification"}
            description="Vous serez prévenu ici des nouveaux messages et des mises à jour."
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
                      "flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-50",
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
    </div>
  );
}
