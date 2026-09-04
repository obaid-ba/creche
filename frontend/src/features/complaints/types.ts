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

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  NEW: "Nouvelle",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolue",
  CLOSED: "Clôturée",
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
