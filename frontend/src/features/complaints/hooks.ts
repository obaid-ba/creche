import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { complaintsApi, type ComplaintListParams } from "./api";
import type { ComplaintStatus } from "./types";

export const complaintKeys = {
  all: ["complaints"] as const,
  list: (params: ComplaintListParams) =>
    [...complaintKeys.all, "list", params] as const,
};

export function useComplaints(params: ComplaintListParams) {
  return useQuery({
    queryKey: complaintKeys.list(params),
    queryFn: () => complaintsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

function useComplaintInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: complaintKeys.all });
}

export function useCreateComplaint() {
  const invalidate = useComplaintInvalidation();
  return useMutation({
    mutationFn: (input: {
      subject: string;
      message: string;
      child_id?: string | null;
    }) => complaintsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useChangeStatus() {
  const invalidate = useComplaintInvalidation();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ComplaintStatus }) =>
      complaintsApi.changeStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useReplyToComplaint() {
  const invalidate = useComplaintInvalidation();
  return useMutation({
    mutationFn: ({
      id,
      body,
      isInternal,
    }: {
      id: string;
      body: string;
      isInternal?: boolean;
    }) => complaintsApi.reply(id, body, isInternal ?? false),
    onSuccess: invalidate,
  });
}
