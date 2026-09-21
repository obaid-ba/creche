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

/** The whole of a parent's credential. There is no password. */
export interface CodeLoginInput {
  access_code: string;
  child_name: string;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>("/auth/login/", input);
    return data;
  },

  async codeLogin(input: CodeLoginInput): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>(
      "/auth/parent/code-login/",
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
