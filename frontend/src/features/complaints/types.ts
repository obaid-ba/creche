import type { Role } from "@/types/api";

export type ComplaintStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface ComplaintReply {
  id: string;
  body: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    role: Role;
  } | null;
  /** Staff working notes; never present in a parent's payload. */
  is_internal: boolean;
  created_at: string;
}

export interface Complaint {
  id: string;
  subject: string;
  message: string;
  status: ComplaintStatus;
  status_label: string;
  parent: { id: string; first_name: string; last_name: string; email: string };
  child: { id: string; first_name: string; last_name: string } | null;
  replies: ComplaintReply[];
  /** Only the moves the server will accept; empty for parents. */
  allowed_transitions: ComplaintStatus[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Translation keys, not copy: see `features/auth/schemas.ts` for why a
 *  module constant cannot hold translated text. The API also sends
 *  `status_label` already translated; this is for the filter dropdown,
 *  which lists statuses that no loaded complaint may have. */
export const STATUS_LABEL_KEYS: Record<ComplaintStatus, string> = {
  NEW: "complaints.state.NEW",
  IN_PROGRESS: "complaints.state.IN_PROGRESS",
  RESOLVED: "complaints.state.RESOLVED",
  CLOSED: "complaints.state.CLOSED",
};

export const STATUS_TONES: Record<
  ComplaintStatus,
  "info" | "warning" | "success" | "neutral"
> = {
  NEW: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};
