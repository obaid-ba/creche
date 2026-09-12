import { Bell, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/cn";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationCount,
  useNotifications,
} from "../hooks";
import { NOTIFICATION_ICONS } from "../types";

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `il y a ${Math.floor(seconds / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const count = useNotificationCount();
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on an outside click or Escape, like any menu.
  useEffect(() => {
    if (!isOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const unread = count.data ?? 0;
  const items = list.data?.results ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={
          unread > 0 ? `Notifications (${unread} non lues)` : "Notifications"
        }
        className="relative rounded-pill p-2 text-ink-600 transition-colors hover:bg-ink-100"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary-600 px-1 text-[0.65rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-ink-100 bg-white shadow-lifted">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <p className="font-bold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
              >
                <Check aria-hidden="true" className="size-3" />
                Tout marquer comme lu
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">
              Aucune notification.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.is_read) markRead.mutate(item.id);
                      setIsOpen(false);
                      if (item.link !== "") navigate(item.link);
                    }}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-ink-50",
                      !item.is_read && "bg-primary-50/60",
                    )}
                  >
                    <span aria-hidden="true" className="text-lg">
                      {NOTIFICATION_ICONS[item.type] ?? "🔔"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {item.title}
                      </span>
                      {item.body !== "" && (
                        <span className="mt-0.5 block truncate text-xs text-ink-600">
                          {item.body}
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-ink-400">
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                    {!item.is_read && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
