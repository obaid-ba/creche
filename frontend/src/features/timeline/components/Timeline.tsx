import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/ui";

import type { TimelineEvent } from "../types";
import { TimelineItem } from "./TimelineItem";

export function Timeline({
  events,
  onEnd,
  endingId,
  emptyMessage,
}: {
  events: TimelineEvent[];
  onEnd?: (eventId: string) => void;
  endingId?: string | null;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-6" />}
        title={t("day.emptyDay")}
        description={emptyMessage ?? t("day.emptyDayHint")}
      />
    );
  }

  return (
    <ol className="mt-2">
      {events.map((event, index) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={index === events.length - 1}
          {...(onEnd !== undefined ? { onEnd } : {})}
          isEnding={endingId === event.id}
        />
      ))}
    </ol>
  );
}
