import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

export interface ParentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  emergency_phone: string;
  is_active: boolean;
  last_login_at: string | null;
  children: {
    id: string;
    first_name: string;
    last_name: string;
    relationship: string;
    is_primary: boolean;
  }[];
}

export interface StaffRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "STAFF" | "ADMIN";
  job_title: string;
  assigned_age_group: string;
  hired_on: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export const directoryApi = {
  async parents(params: { search?: string; unlinked?: string; page?: number }) {
    const query: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") query[k] = v;
    }
    const { data } = await apiClient.get<PageResponse<ParentRow>>("/parents/", {
      params: query,
    });
    return data;
  },

  async staff() {
    const { data } = await apiClient.get<PageResponse<StaffRow>>("/staff/");
    return data;
  },

  async createStaff(input: {
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    job_title?: string;
    role: string;
  }) {
    const { data } = await apiClient.post<StaffRow>("/staff/", input);
    return data;
  },

  async deactivateStaff(id: string) {
    const { data } = await apiClient.post<StaffRow>(`/staff/${id}/deactivate/`);
    return data;
  },

  async reactivateStaff(id: string) {
    const { data } = await apiClient.post<StaffRow>(`/staff/${id}/reactivate/`);
    return data;
  },
};
