import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { PageResponse } from "@/types/api";

import { childrenApi, type ChildWriteInput } from "./api";
import type {
  AgeGroupCount,
  ChildDetail,
  ChildListItem,
  ChildListParams,
} from "./types";

/** One place that builds cache keys, so invalidation cannot drift. */
export const childrenKeys = {
  all: ["children"] as const,
  lists: () => [...childrenKeys.all, "list"] as const,
  list: (params: ChildListParams) => [...childrenKeys.lists(), params] as const,
  details: () => [...childrenKeys.all, "detail"] as const,
  detail: (id: string) => [...childrenKeys.details(), id] as const,
  ageGroups: () => [...childrenKeys.all, "age-groups"] as const,
};

export function useChildren(
  params: ChildListParams,
): UseQueryResult<PageResponse<ChildListItem>> {
  return useQuery({
    queryKey: childrenKeys.list(params),
    queryFn: () => childrenApi.list(params),
    // Keeps the previous page visible while the next one loads, instead of
    // flashing an empty table on every keystroke or page change.
    placeholderData: (previous) => previous,
  });
}

export function useChild(id: string | undefined) {
  return useQuery({
    queryKey: childrenKeys.detail(id ?? ""),
    queryFn: () => childrenApi.get(id as string),
    enabled: id !== undefined && id !== "",
  });
}

export function useAgeGroups() {
  return useQuery({
    queryKey: childrenKeys.ageGroups(),
    queryFn: () => childrenApi.ageGroups(),
  });
}

/** Counts and lists both change after a write, so invalidate the whole tree. */
function useChildInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: childrenKeys.all });
}

export function useCreateChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: (input: ChildWriteInput) => childrenApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateChild(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ChildWriteInput>) =>
      childrenApi.update(id, input),
    onSuccess: (child: ChildDetail) => {
      // Seed the detail cache from the response so the profile page does
      // not refetch what the server just returned.
      queryClient.setQueryData(childrenKeys.detail(id), child);
      void queryClient.invalidateQueries({ queryKey: childrenKeys.lists() });
    },
  });
}

export function useArchiveChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: (id: string) => childrenApi.archive(id),
    onSuccess: invalidate,
  });
}

export function useRestoreChild() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: (id: string) => childrenApi.restore(id),
    onSuccess: invalidate,
  });
}

export function useIssueAccessCode() {
  const invalidate = useChildInvalidation();
  return useMutation({
    mutationFn: (id: string) => childrenApi.issueAccessCode(id),
    onSuccess: invalidate,
  });
}

export type { AgeGroupCount };
