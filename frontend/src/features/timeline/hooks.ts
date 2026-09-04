import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { timelineApi, type TimelineParams } from "./api";
import type { CreateEventInput } from "./types";

export const timelineKeys = {
  all: ["timeline"] as const,
  child: (childId: string) => [...timelineKeys.all, childId] as const,
  day: (childId: string, params: TimelineParams) =>
    [...timelineKeys.child(childId), params] as const,
  record: (childId: string, date: string) =>
    [...timelineKeys.child(childId), "record", date] as const,
  eventTypes: () => [...timelineKeys.all, "event-types"] as const,
};

export function useTimeline(childId: string | undefined, params: TimelineParams) {
  return useQuery({
    queryKey: timelineKeys.day(childId ?? "", params),
    queryFn: () => timelineApi.list(childId as string, params),
    enabled: childId !== undefined && childId !== "",
    placeholderData: (previous) => previous,
  });
}

export function useDailyRecord(childId: string | undefined, date: string) {
  return useQuery({
    queryKey: timelineKeys.record(childId ?? "", date),
    queryFn: () => timelineApi.dailyRecord(childId as string, date),
    enabled: childId !== undefined && childId !== "",
  });
}

/** The registry drives labels, icons and chips — never hardcoded client-side. */
export function useEventTypes() {
  return useQuery({
    queryKey: timelineKeys.eventTypes(),
    queryFn: () => timelineApi.eventTypes(),
    // The registry only changes on deploy, so it need not be refetched.
    staleTime: Infinity,
  });
}

function useTimelineInvalidation(childId: string) {
  const queryClient = useQueryClient();
  // The summary is derived from the same events, so both must refresh.
  return () =>
    queryClient.invalidateQueries({ queryKey: timelineKeys.child(childId) });
}

export function useCreateEvent(childId: string) {
  const invalidate = useTimelineInvalidation(childId);
  return useMutation({
    mutationFn: (input: CreateEventInput) => timelineApi.create(childId, input),
    onSuccess: invalidate,
  });
}

export function useEndEvent(childId: string) {
  const invalidate = useTimelineInvalidation(childId);
  return useMutation({
    mutationFn: (eventId: string) => timelineApi.end(eventId),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent(childId: string) {
  const invalidate = useTimelineInvalidation(childId);
  return useMutation({
    mutationFn: (eventId: string) => timelineApi.remove(eventId),
    onSuccess: invalidate,
  });
}

export function usePublishDay(childId: string) {
  const invalidate = useTimelineInvalidation(childId);
  return useMutation({
    mutationFn: (date: string) => timelineApi.publish(childId, date),
    onSuccess: invalidate,
  });
}

export function useSaveNotes(childId: string) {
  const invalidate = useTimelineInvalidation(childId);
  return useMutation({
    mutationFn: ({ date, notes }: { date: string; notes: string }) =>
      timelineApi.saveNotes(childId, date, notes),
    onSuccess: invalidate,
  });
}
