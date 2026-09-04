import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

import type { Complaint, ComplaintStatus } from "./types";

export interface ComplaintListParams {
  status?: string;
  child?: string;
  page?: number;
}

export const complaintsApi = {
  async list(params: ComplaintListParams): Promise<PageResponse<Complaint>> {
    const query: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query[key] = value as string;
    }
    const { data } = await apiClient.get<PageResponse<Complaint>>(
      "/complaints/",
      { params: query },
    );
    return data;
  },

  async create(input: {
    subject: string;
    message: string;
    child_id?: string | null;
  }): Promise<Complaint> {
    const { data } = await apiClient.post<Complaint>("/complaints/", input);
    return data;
  },

  async changeStatus(id: string, status: ComplaintStatus): Promise<Complaint> {
    const { data } = await apiClient.patch<Complaint>(
      `/complaints/${id}/status/`,
      { status },
    );
    return data;
  },

  async reply(
    id: string,
    body: string,
    isInternal = false,
  ): Promise<Complaint> {
    const { data } = await apiClient.post<Complaint>(
      `/complaints/${id}/replies/`,
      { body, is_internal: isInternal },
    );
    return data;
  },
};
