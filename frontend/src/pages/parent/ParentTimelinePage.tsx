import { useState } from "react";

import { Card, CardBody, ErrorState, LoadingState } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { DailySummaryCards } from "@/features/daily-records/components/DailySummaryCards";
import { Timeline } from "@/features/timeline/components/Timeline";
import {
  DateSelector,
  describeDate,
  todayISO,
} from "@/features/timeline/components/DateSelector";
import { TimelineFilters } from "@/features/timeline/components/TimelineFilters";
import {
  useDailyRecord,
  useEventTypes,
  useTimeline,
} from "@/features/timeline/hooks";
import type { TimelineFilter } from "@/features/timeline/types";

/**
 * The parent's view of their child's day (brief 10-11).
 *
 * Login → see child → see today's situation → see the timeline, with as
 * few steps as possible.
 */
export function ParentTimelinePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const child = user?.children[0];
  const childId = child?.id;

  const timeline = useTimeline(childId, { date, filter });
  const record = useDailyRecord(childId, date);
  const eventTypes = useEventTypes();

  if (child === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <ErrorState
          title="Aucun enfant rattaché"
          description="Contactez la crèche pour rattacher votre enfant à votre compte."
        />
      </div>
    );
  }

  const summary = record.data?.summary;
  const isDraft = record.data?.status === "DRAFT";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{child.first_name}</h1>
        <p className="mt-1 capitalize text-ink-500">{describeDate(date)}</p>
      </header>

      <DateSelector value={date} onChange={setDate} className="mb-6" />

      {summary !== undefined && summary.event_count > 0 && (
        <div className="mb-6">
          <DailySummaryCards summary={summary} />
        </div>
      )}

      <div className="mb-4">
        <TimelineFilters
          value={filter}
          onChange={setFilter}
          options={eventTypes.data?.filters ?? []}
        />
      </div>

      <Card>
        <CardBody>
          {timeline.isPending ? (
            <LoadingState label="Chargement de la journée…" />
          ) : timeline.isError ? (
            <ErrorState
              description="Impossible de charger la journée."
              onRetry={() => void timeline.refetch()}
            />
          ) : (
            <Timeline
              events={timeline.data.results}
              emptyMessage={
                isDraft
                  ? "La journée n'a pas encore été publiée par la crèche."
                  : "Aucun événement enregistré pour cette journée."
              }
            />
          )}
        </CardBody>
      </Card>

      {record.data !== undefined &&
        record.data.general_notes.trim() !== "" && (
          <Card className="mt-5">
            <CardBody>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-400">
                Mot de l'équipe
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-ink-700">
                {record.data.general_notes}
              </p>
            </CardBody>
          </Card>
        )}
    </div>
  );
}
