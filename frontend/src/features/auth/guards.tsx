import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "@/components/ui";
import type { Role } from "@/types/api";

import { useAuth } from "./useAuth";

/**
 * Route guards are a **UX affordance, not a security control**.
 *
 * They stop a user seeing a screen that would fail anyway. Every protected
 * endpoint enforces its own permissions server-side, and the frontend is
 * treated as untrusted (docs/authentication.md 5).
 */

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <LoadingState label="Vérification de la session…" />;

  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith("/staff")
      ? "/staff/login"
      : "/parent/login";
    // `state.from` lets the login page send the user back where they were.
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return children !== undefined ? <>{children}</> : <Outlet />;
}

export function RequireRole({
  allowed,
  children,
}: {
  allowed: readonly Role[];
  children?: ReactNode;
}) {
  const { role, isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <LoadingState label="Vérification de la session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/parent/login" state={{ from: location }} replace />;
  }

  if (role === null || !allowed.includes(role)) {
    // Send them to their own space rather than showing a dead end.
    return <Navigate to={role === "PARENT" ? "/parent" : "/staff"} replace />;
  }

  return children !== undefined ? <>{children}</> : <Outlet />;
}

/** Keeps an already-authenticated user off the login pages. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, role, isBootstrapping } = useAuth();

  if (isBootstrapping) return <LoadingState />;
  if (isAuthenticated) {
    return <Navigate to={role === "PARENT" ? "/parent" : "/staff"} replace />;
  }
  return <>{children}</>;
}
