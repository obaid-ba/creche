import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthContext, type AuthContextValue } from "../AuthContext";
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from "../guards";
import type { CurrentUser, Role } from "@/types/api";

function makeUser(role: Role): CurrentUser {
  return {
    id: "u1",
    email: "a@b.co",
    first_name: "Sarah",
    last_name: "Benali",
    phone: "",
    role,
    children: [],
  };
}

function renderGuarded(
  ui: ReactNode,
  {
    role = null,
    isBootstrapping = false,
    at = "/protected",
  }: { role?: Role | null; isBootstrapping?: boolean; at?: string } = {},
) {
  const value: AuthContextValue = {
    user: role === null ? null : makeUser(role),
    role,
    isAuthenticated: role !== null,
    isBootstrapping,
    login: async () => makeUser("PARENT"),
    claim: async () => makeUser("PARENT"),
    logout: async () => undefined,
    refreshUser: async () => undefined,
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/protected" element={ui} />
          <Route path="/staff/protected" element={ui} />
          <Route path="/parent/login" element={<p>Connexion parents</p>} />
          <Route path="/staff/login" element={<p>Connexion personnel</p>} />
          <Route path="/parent" element={<p>Espace parent</p>} />
          <Route path="/staff" element={<p>Espace personnel</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("renders the page for an authenticated user", () => {
    renderGuarded(
      <RequireAuth>
        <p>Contenu protégé</p>
      </RequireAuth>,
      { role: "PARENT" },
    );

    expect(screen.getByText("Contenu protégé")).toBeInTheDocument();
  });

  it("redirects an anonymous visitor to the parent login", () => {
    renderGuarded(
      <RequireAuth>
        <p>Contenu protégé</p>
      </RequireAuth>,
    );

    expect(screen.getByText("Connexion parents")).toBeInTheDocument();
  });

  it("redirects to the staff login when the target is a staff route", () => {
    renderGuarded(
      <RequireAuth>
        <p>Contenu protégé</p>
      </RequireAuth>,
      { at: "/staff/protected" },
    );

    expect(screen.getByText("Connexion personnel")).toBeInTheDocument();
  });

  it("waits while the session is being restored rather than flashing the login", () => {
    renderGuarded(
      <RequireAuth>
        <p>Contenu protégé</p>
      </RequireAuth>,
      { isBootstrapping: true },
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Connexion parents")).not.toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("allows a role on the list", () => {
    renderGuarded(
      <RequireRole allowed={["STAFF", "ADMIN"]}>
        <p>Tableau de bord</p>
      </RequireRole>,
      { role: "STAFF" },
    );

    expect(screen.getByText("Tableau de bord")).toBeInTheDocument();
  });

  it("treats ADMIN as satisfying a STAFF-and-ADMIN route", () => {
    renderGuarded(
      <RequireRole allowed={["STAFF", "ADMIN"]}>
        <p>Tableau de bord</p>
      </RequireRole>,
      { role: "ADMIN" },
    );

    expect(screen.getByText("Tableau de bord")).toBeInTheDocument();
  });

  it("sends a parent away from a staff route to their own space", () => {
    renderGuarded(
      <RequireRole allowed={["STAFF", "ADMIN"]}>
        <p>Tableau de bord</p>
      </RequireRole>,
      { role: "PARENT" },
    );

    expect(screen.queryByText("Tableau de bord")).not.toBeInTheDocument();
    expect(screen.getByText("Espace parent")).toBeInTheDocument();
  });

  it("sends staff away from a parent-only route", () => {
    renderGuarded(
      <RequireRole allowed={["PARENT"]}>
        <p>Espace privé</p>
      </RequireRole>,
      { role: "STAFF" },
    );

    expect(screen.queryByText("Espace privé")).not.toBeInTheDocument();
    expect(screen.getByText("Espace personnel")).toBeInTheDocument();
  });

  it("redirects an anonymous visitor to a login page", () => {
    renderGuarded(
      <RequireRole allowed={["PARENT"]}>
        <p>Espace privé</p>
      </RequireRole>,
    );

    expect(screen.getByText("Connexion parents")).toBeInTheDocument();
  });
});

describe("RedirectIfAuthenticated", () => {
  it("lets an anonymous visitor see the login page", () => {
    renderGuarded(
      <RedirectIfAuthenticated>
        <p>Formulaire de connexion</p>
      </RedirectIfAuthenticated>,
    );

    expect(screen.getByText("Formulaire de connexion")).toBeInTheDocument();
  });

  it("sends a signed-in parent to their space", () => {
    renderGuarded(
      <RedirectIfAuthenticated>
        <p>Formulaire de connexion</p>
      </RedirectIfAuthenticated>,
      { role: "PARENT" },
    );

    expect(screen.getByText("Espace parent")).toBeInTheDocument();
  });

  it("sends signed-in staff to their dashboard", () => {
    renderGuarded(
      <RedirectIfAuthenticated>
        <p>Formulaire de connexion</p>
      </RedirectIfAuthenticated>,
      { role: "ADMIN" },
    );

    expect(screen.getByText("Espace personnel")).toBeInTheDocument();
  });
});
