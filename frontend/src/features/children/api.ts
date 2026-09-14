import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

import type {
  AgeGroupCount,
  ChildDetail,
  ChildListItem,
  ChildListParams,
  GuardianInput,
  IssuedAccessCode,
} from "./types";

// Optional fields are written `| undefined` because
// exactOptionalPropertyTypes is on: a form field left blank arrives as
// undefined, and the compiler treats that as distinct from absent.
export interface ChildWriteInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string | undefined;
  registration_date?: string | null | undefined;
  allergies?: string | undefined;
  medical_notes?: string | undefined;
  notes?: string | undefined;
}

/** Drops empty values so blank filters do not become `?search=` noise. */
function cleanParams(params: ChildListParams): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      cleaned[key] = value as string | number;
    }
  }
  return cleaned;
}

export const childrenApi = {
  async list(params: ChildListParams): Promise<PageResponse<ChildListItem>> {
    const { data } = await apiClient.get<PageResponse<ChildListItem>>(
      "/children/",
      { params: cleanParams(params) },
    );
    return data;
  },

  async get(id: string): Promise<ChildDetail> {
    const { data } = await apiClient.get<ChildDetail>(`/children/${id}/`);
    return data;
  },

  async create(input: ChildWriteInput): Promise<ChildDetail> {
    const { data } = await apiClient.post<ChildDetail>("/children/", input);
    return data;
  },

  async update(id: string, input: Partial<ChildWriteInput>): Promise<ChildDetail> {
    const { data } = await apiClient.patch<ChildDetail>(`/children/${id}/`, input);
    return data;
  },

  async archive(id: string): Promise<ChildDetail> {
    const { data } = await apiClient.post<ChildDetail>(`/children/${id}/archive/`);
    return data;
  },

  async restore(id: string): Promise<ChildDetail> {
    const { data } = await apiClient.post<ChildDetail>(`/children/${id}/restore/`);
    return data;
  },

  async ageGroups(): Promise<AgeGroupCount[]> {
    const { data } = await apiClient.get<AgeGroupCount[]>("/age-groups/");
    return data;
  },

  /** Enrol a parent from the paper form. The plaintext code comes back
   *  once here and is never retrievable again. */
  async addGuardian(id: string, input: GuardianInput): Promise<IssuedAccessCode> {
    const { data } = await apiClient.post<IssuedAccessCode>(
      `/children/${id}/guardians/`,
      input,
    );
    return data;
  },

  /** Reissue one guardian's code — for a paper that has gone missing. */
  async issueAccessCode(
    id: string,
    parentId: string,
  ): Promise<IssuedAccessCode> {
    const { data } = await apiClient.post<IssuedAccessCode>(
      `/children/${id}/guardians/${parentId}/access-code/`,
    );
    return data;
  },

  async revokeAccessCode(id: string, parentId: string): Promise<void> {
    await apiClient.delete(`/children/${id}/guardians/${parentId}/access-code/`);
  },

  async revokeGuardian(childId: string, guardianId: string): Promise<void> {
    await apiClient.delete(`/children/${childId}/guardians/${guardianId}/`);
  },
};
