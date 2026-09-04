import type { AgeGroup, AgeGroupKey, ChildStatus } from "@/types/api";

export interface Guardian {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  relationship: "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER";
  is_primary: boolean;
}

/** Row shape in the staff children list. */
export interface ChildListItem {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  age_months: number;
  age_display: string;
  age_group: AgeGroup;
  gender: "M" | "F" | "OTHER" | "";
  photo_url: string | null;
  status: ChildStatus;
  allergies: string;
}

export interface ChildDetail extends ChildListItem {
  registration_date: string | null;
  medical_notes: string;
  notes: string;
  archived_at: string | null;
  guardians: Guardian[];
  has_active_access_code: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgeGroupCount {
  key: AgeGroupKey;
  label: string;
  count: number;
}

export interface ChildListParams {
  search?: string;
  age_group?: AgeGroupKey | "";
  status?: ChildStatus | "";
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface IssuedAccessCode {
  code: string;
  expires_at: string;
  hint: string;
}
