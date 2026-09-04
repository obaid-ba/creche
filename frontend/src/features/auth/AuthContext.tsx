import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { refreshAccessToken, setSessionExpiredHandler } from "@/services/client";
import { clearAccessToken, setAccessToken } from "@/services/tokenStore";
import type { CurrentUser, Role } from "@/types/api";

import { authApi, type AuthSession, type ClaimInput, type LoginInput } from "./api";

export interface AuthContextValue {
  user: CurrentUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** True only while the initial silent refresh is in flight. */
  isBootstrapping: boolean;
  login: (input: LoginInput) => Promise<CurrentUser>;
  claim: (input: ClaimInput) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const applySession = useCallback((session: AuthSession) => {
    setAccessToken(session.access);
    setUser(session.user);
    return session.user;
  }, []);

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  /**
   * Silent refresh on boot.
   *
   * The access token lives in memory, so a page reload loses it. The
   * httpOnly refresh cookie survives, and the browser attaches it
   * automatically — so the session is recovered without ever exposing a
   * long-lived credential to JavaScript (docs/authentication.md 2).
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refreshAccessToken();
        const currentUser = await authApi.me();
        if (!cancelled) setUser(currentUser);
      } catch {
        // No valid session: an ordinary anonymous visit, not an error.
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // A refresh failure mid-session must drop the user, not leave stale data
  // from another account on screen.
  useEffect(() => {
    setSessionExpiredHandler(clearSession);
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(
    async (input: LoginInput) => applySession(await authApi.login(input)),
    [applySession],
  );

  const claim = useCallback(
    async (input: ClaimInput) => applySession(await authApi.claim(input)),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear locally even if the request failed — the user asked to leave.
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    setUser(await authApi.me());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: user !== null,
      isBootstrapping,
      login,
      claim,
      logout,
      refreshUser,
    }),
    [user, isBootstrapping, login, claim, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
