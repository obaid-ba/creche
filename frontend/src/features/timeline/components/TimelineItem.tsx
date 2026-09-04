import { Square } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

import {
  eventDetail,
  eventEmoji,
  formatTime,
  groupAccent,
} from "../eventDisplay";
import type { TimelineEvent } from "../types";

/**
 * One entry in the feed.
 *
 * Desktop shows a vertical rail with the time in a fixed gutter; on
 * mobile the same markup collapses into a compact card (brief 10).
 */
export function TimelineItem({
  event,
  isLast,
  onEnd,
  isEnding = false,
}: {
  event: TimelineEvent;
  isLast: boolean;
  onEnd?: (eventId: string) => void;
  isEnding?: boolean;
}) {
  const detail = eventDetail(event);

  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* Rail: the connector is decorative, so it is hidden from AT. */}
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-lg",
            groupAccent(event.group),
          )}
        >
          {eventEmoji(event.type)}
        </span>
        {!isLast && (
          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-ink-100" />
        )}
      </div>

      <div className="flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <time
            dateTime={event.occurred_at}
            className="font-mono text-sm font-bold text-ink-400"
          >
            {formatTime(event.occurred_at)}
          </time>
          <h3 className="font-bold text-ink-900">{event.label}</h3>
          {event.is_open_interval && (
            <span className="rounded-pill bg-secondary-100 px-2 py-0.5 text-xs font-bold text-secondary-700">
              En cours
            </span>
          )}
        </div>

        {detail !== "" && (
          <p className="mt-0.5 text-sm text-ink-600">{detail}</p>
        )}

        {event.description !== "" && detail !== event.description && (
          <p className="mt-1 text-sm text-ink-500">{event.description}</p>
        )}

        {event.created_by !== null && (
          <p className="mt-1 text-xs text-ink-400">
            Par {event.created_by.first_name}
          </p>
        )}

        {event.is_open_interval && onEnd !== undefined && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            isLoading={isEnding}
            onClick={() => onEnd(event.id)}
            leftIcon={<Square className="size-3.5" />}
          >
            Terminer
          </Button>
        )}
      </div>
    </li>
  );
}
