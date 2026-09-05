import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { directoryApi } from "./api";

export const directoryKeys = {
  all: ["directory"] as const,
  parents: (params: object) => [...directoryKeys.all, "parents", params] as const,
  staff: () => [...directoryKeys.all, "staff"] as const,
};

export function useParents(params: {
  search?: string;
  unlinked?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: directoryKeys.parents(params),
    queryFn: () => directoryApi.parents(params),
    placeholderData: (previous) => previous,
  });
}

export function useStaffMembers() {
  return useQuery({
    queryKey: directoryKeys.staff(),
    queryFn: () => directoryApi.staff(),
  });
}

function useDirectoryInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: directoryKeys.all });
}

export function useSetParentMessaging() {
  const invalidate = useDirectoryInvalidation();
  return useMutation({
    mutationFn: ({ id, canSend }: { id: string; canSend: boolean }) =>
      directoryApi.setMessaging(id, canSend),
    onSuccess: invalidate,
  });
}

export function useCreateStaff() {
  const invalidate = useDirectoryInvalidation();
  return useMutation({
    mutationFn: directoryApi.createStaff,
    onSuccess: invalidate,
  });
}

export function useToggleStaffActive() {
  const invalidate = useDirectoryInvalidation();
  return useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      activate
        ? directoryApi.reactivateStaff(id)
        : directoryApi.deactivateStaff(id),
    onSuccess: invalidate,
  });
}
