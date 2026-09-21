import { apiClient } from "@/services/client";
import type { CurrentUser } from "@/types/api";

export interface ProfileInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  emergency_phone?: string;
}

export const profileApi = {
  async update(input: ProfileInput): Promise<CurrentUser> {
    const { data } = await apiClient.patch<CurrentUser>("/auth/me/", input);
    return data;
  },

  async changePassword(input: {
    current_password: string;
    new_password: string;
  }): Promise<void> {
    await apiClient.post("/auth/password/change/", input);
  },

  /** Attach another child using a code the nursery issued. */
};
