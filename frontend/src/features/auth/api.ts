import { apiClient } from "@/services/client";
import type { CurrentUser } from "@/types/api";

export interface AuthSession {
  access: string;
  expires_in: number;
  user: CurrentUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ClaimInput {
  access_code: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  // Explicit `| undefined` because exactOptionalPropertyTypes is on: an
  // optional form field that is left blank arrives as undefined.
  phone?: string | undefined;
  relationship: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>("/auth/login/", input);
    return data;
  },

  async claim(input: ClaimInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>(
      "/auth/parent/claim/",
      input,
    );
    return data;
  },

  async linkChild(input: {
    access_code: string;
    relationship: string;
  }): Promise<CurrentUser> {
    const { data } = await apiClient.post<CurrentUser>(
      "/auth/parent/link-child/",
      input,
    );
    return data;
  },

  async me(): Promise<CurrentUser> {
    const { data } = await apiClient.get<CurrentUser>("/auth/me/");
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout/");
  },

  async changePassword(input: {
    current_password: string;
    new_password: string;
  }): Promise<void> {
    await apiClient.post("/auth/password/change/", input);
  },
};
