import { Clock, ImageIcon, Users } from "lucide-react";

import { Badge, Card, CardBody } from "@/components/ui";

import type { Activity } from "../types";

const CATEGORY_TONE: Record<string, "primary" | "secondary" | "info" | "warning" | "neutral"> = {
  ART: "primary",
  MUSIC: "secondary",
  OUTDOOR: "info",
  STORY: "warning",
  MOTOR: "secondary",
  EDUCATIONAL: "info",
  OTHER: "neutral",
};

function timeRange(activity: Activity): string | null {
  if (activity.start_time === null) return null;
  const start = activity.start_time.slice(0, 5);
  if (activity.end_time === null) return start;
  return `${start} – ${activity.end_time.slice(0, 5)}`;
}

export function ActivityCard({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick?: () => void;
}) {
  const range = timeRange(activity);
  const cover = activity.photos[0];

  const content = (
    <Card className="h-full overflow-hidden transition-colors hover:border-primary-200">
      {cover?.thumbnail_url != null && (
        <img
          src={cover.thumbnail_url}
          alt={cover.caption !== "" ? cover.caption : ""}
          loading="lazy"
          className="h-36 w-full object-cover"
        />
      )}

      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY_TONE[activity.category] ?? "neutral"}>
            {activity.category_label}
          </Badge>
          {range !== null && (
            <span className="flex items-center gap-1 text-xs text-ink-400">
              <Clock aria-hidden="true" className="size-3" />
              {range}
            </span>
          )}
        </div>

        <h3 className="font-bold text-ink-900">{activity.title}</h3>

        {activity.description !== "" && (
          <p className="line-clamp-2 text-sm text-ink-600">
            {activity.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="flex items-center gap-1">
            <Users aria-hidden="true" className="size-3.5" />
            {activity.participant_count} enfant
            {activity.participant_count === 1 ? "" : "s"}
          </span>
          {activity.photos.length > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon aria-hidden="true" className="size-3.5" />
              {activity.photos.length}
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );

  if (onClick === undefined) return content;

  return (
    <button type="button" onClick={onClick} className="w-full text-start">
      {content}
    </button>
  );
}
