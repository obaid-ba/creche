import { Send } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { PageShell } from "@/components/app";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { useChild } from "@/features/children/hooks";
import { DailySummaryCards } from "@/features/daily-records/components/DailySummaryCards";
import { Timeline } from "@/features/timeline/components/Timeline";
import {
  DateSelector,
  describeDate,
  todayISO,
} from "@/features/timeline/components/DateSelector";
import { QuickAddBar } from "@/features/timeline/components/QuickAddBar";
import { TimelineFilters } from "@/features/timeline/components/TimelineFilters";
import {
  useCreateEvent,
  useDailyRecord,
  useEndEvent,
  useEventTypes,
  usePublishDay,
  useSaveNotes,
  useTimeline,
} from "@/features/timeline/hooks";
import type { TimelineFilter } from "@/features/timeline/types";

export function StaffChildTimelinePage() {
  const { childId = "" } = useParams<{ childId: string }>();
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [notes, setNotes] = useState<string | null>(null);

  const childQuery = useChild(childId);
  const timeline = useTimeline(childId, { date, filter });
  const record = useDailyRecord(childId, date);
  const eventTypes = useEventTypes();

  const createEvent = useCreateEvent(childId);
  const endEvent = useEndEvent(childId);
  const publishDay = usePublishDay(childId);
  const saveNotes = useSaveNotes(childId);

  if (childQuery.isPending) return <LoadingState label="Chargement…" />;
  if (childQuery.isError) {
    return (
      <ErrorState
        title="Enfant introuvable"
        description="Ce dossier n'existe pas ou vous n'y avez pas accès."
      />
    );
  }

  const child = childQuery.data;
  const summary = record.data?.summary;
  const isPublished = record.data?.status === "PUBLISHED";
  // `notes` holds the unsaved draft; fall back to what the server has.
  const notesValue = notes ?? record.data?.general_notes ?? "";

  return (
    <PageShell size="form">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">{child.full_name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {child.age_display} · <span className="capitalize">{describeDate(date)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPublished ? (
            <Badge tone="success">Journée publiée</Badge>
          ) : (
            <Badge tone="warning">Brouillon</Badge>
          )}
          <Button
            size="sm"
            isLoading={publishDay.isPending}
            onClick={() => publishDay.mutate(date)}
            leftIcon={<Send className="size-4" />}
          >
            {isPublished ? "Republier" : "Publier la journée"}
          </Button>
        </div>
      </header>

      <DateSelector value={date} onChange={setDate} className="mb-6" />

      {!isPublished && (
        <div className="mb-5">
          <Alert tone="info">
            Les parents ne verront cette journée qu'une fois publiée.
          </Alert>
        </div>
      )}

      <Card className="mb-5">
        <CardHeader
          title="Enregistrement rapide"
          description="L'événement est daté de l'heure actuelle."
        />
        <CardBody>
          <QuickAddBar
            specs={eventTypes.data?.types ?? []}
            isPending={createEvent.isPending}
            onAdd={(input) => createEvent.mutate(input)}
          />
          {createEvent.isError && (
            <div className="mt-3">
              <Alert tone="danger">
                {createEvent.error.message}
              </Alert>
            </div>
          )}
        </CardBody>
      </Card>

      {summary !== undefined && summary.event_count > 0 && (
        <div className="mb-5">
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
              onEnd={(eventId) => endEvent.mutate(eventId)}
              endingId={endEvent.isPending ? endEvent.variables : null}
              emptyMessage="Aucun événement enregistré pour cette journée."
            />
          )}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Mot de l'équipe"
          description="Visible par les parents une fois la journée publiée."
        />
        <CardBody className="space-y-3">
          <label className="sr-only" htmlFor="general-notes">
            Mot de l'équipe
          </label>
          <textarea
            id="general-notes"
            rows={3}
            value={notesValue}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Très bonne journée, Mohamed a bien mangé…"
            className="w-full rounded-card border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          />
          <Button
            variant="outline"
            size="sm"
            isLoading={saveNotes.isPending}
            onClick={() =>
              saveNotes.mutate(
                { date, notes: notesValue },
                // Drop the local draft so the server value takes over.
                { onSuccess: () => setNotes(null) },
              )
            }
          >
            Enregistrer la note
          </Button>
        </CardBody>
      </Card>
    </PageShell>
  );
}
