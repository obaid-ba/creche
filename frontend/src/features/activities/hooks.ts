import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { timelineKeys } from "@/features/timeline/hooks";

import { activitiesApi } from "./api";
import type { ActivityListParams, ActivityWriteInput } from "./types";

export const activityKeys = {
  all: ["activities"] as const,
  lists: () => [...activityKeys.all, "list"] as const,
  list: (params: ActivityListParams) => [...activityKeys.lists(), params] as const,
  detail: (id: string) => [...activityKeys.all, "detail", id] as const,
};

export function useActivities(params: ActivityListParams) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activitiesApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: activityKeys.detail(id ?? ""),
    queryFn: () => activitiesApi.get(id as string),
    enabled: id !== undefined && id !== "",
  });
}

/**
 * Activity writes also change children's timelines, because participation
 * projects an ACTIVITY event onto each child's day. Both caches are
 * invalidated together so the timeline cannot show a stale activity.
 */
function useActivityInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: activityKeys.all });
    void queryClient.invalidateQueries({ queryKey: timelineKeys.all });
  };
}

export function useCreateActivity() {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: (input: ActivityWriteInput) => activitiesApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateActivity(id: string) {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: (input: Partial<ActivityWriteInput>) =>
      activitiesApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteActivity() {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: (id: string) => activitiesApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useAddParticipants(id: string) {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: (childIds: string[]) => activitiesApi.addParticipants(id, childIds),
    onSuccess: invalidate,
  });
}

export function useRemoveParticipant(id: string) {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: (childId: string) => activitiesApi.removeParticipant(id, childId),
    onSuccess: invalidate,
  });
}

export function useUploadPhoto(id: string) {
  const invalidate = useActivityInvalidation();
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) =>
      activitiesApi.uploadPhoto(id, file, caption),
    onSuccess: invalidate,
  });
}
