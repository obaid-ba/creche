/** Shapes shared across features. Mirrors docs/api.md. */

export type Role = "PARENT" | "STAFF" | "ADMIN";

export type AgeGroupKey = "INFANT" | "BABY" | "TODDLER" | "PRESCHOOL";

export interface AgeGroup {
  key: AgeGroupKey;
  label: string;
}

export interface UserSummary {
  id: string;
  first_name: string;
  last_name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone: string;
  children: ChildSummary[];
  /** Presentation only - the server still enforces the rule. */
  can_send_messages: boolean;
}

export interface ChildSummary {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export type ChildStatus = "ACTIVE" | "ARCHIVED" | "WAITLIST";

export interface Child extends ChildSummary {
  date_of_birth: string;
  /** Computed server-side from date_of_birth — never stored. */
  age_months: number;
  age_display: string;
  age_group: AgeGroup;
  gender: "M" | "F" | "OTHER" | "";
  status: ChildStatus;
  allergies?: string;
  notes?: string;
}

/** The envelope every non-2xx response uses (docs/api.md 3). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Record<string, string[]>;
    request_id: string;
  };
}

export interface PageResponse<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface CursorResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}
