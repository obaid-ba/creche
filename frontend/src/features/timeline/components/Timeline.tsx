import { CalendarClock } from "lucide-react";

import { EmptyState } from "@/components/ui";

import type { TimelineEvent } from "../types";
import { TimelineItem } from "./TimelineItem";

export function Timeline({
  events,
  onEnd,
  endingId,
  emptyMessage = "Aucun événement pour cette journée.",
}: {
  events: TimelineEvent[];
  onEnd?: (eventId: string) => void;
  endingId?: string | null;
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-6" />}
        title="Journée vide"
        description={emptyMessage}
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
