import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/services/errors";
import type { CurrentUser, Role } from "@/types/api";

import { AuthContext, type AuthContextValue } from "../AuthContext";
import { LoginForm } from "../components/LoginForm";

function makeUser(role: Role): CurrentUser {
  return {
    id: "u1",
    email: "sarah@example.com",
    first_name: "Sarah",
    last_name: "Benali",
    phone: "",
    role,
    children: [],
  };
}

function renderLogin(login: AuthContextValue["login"], at = "/parent/login") {
  const value: AuthContextValue = {
    user: null,
    role: null,
    isAuthenticated: false,
    isBootstrapping: false,
    login,
    codeLogin: async () => makeUser("PARENT"),
    logout: async () => undefined,
    refreshUser: async () => undefined,
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/parent/login" element={<LoginForm area="parent" />} />
          <Route path="/staff/login" element={<LoginForm area="staff" />} />
          <Route path="/parent" element={<p>Espace parent</p>} />
          <Route path="/staff" element={<p>Espace personnel</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText(/adresse e-mail/i), email);
  await userEvent.type(screen.getByLabelText(/mot de passe/i), password);
  await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the credentials and routes a parent to their space", async () => {
    const login = vi.fn().mockResolvedValue(makeUser("PARENT"));
    renderLogin(login);

    await fillAndSubmit("sarah@example.com", "TestPass!2345");

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "sarah@example.com",
        password: "TestPass!2345",
      });
    });
    expect(await screen.findByText("Espace parent")).toBeInTheDocument();
  });

  it("routes by the role the server returned, not the form that was used", async () => {
    // A staff member typing into the parent form must still land correctly.
    const login = vi.fn().mockResolvedValue(makeUser("STAFF"));
    renderLogin(login, "/parent/login");

    await fillAndSubmit("staff@example.com", "TestPass!2345");

    expect(await screen.findByText("Espace personnel")).toBeInTheDocument();
  });

  it("shows the backend message when credentials are rejected", async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        code: "validation_error",
        message: "Identifiants invalides.",
        status: 400,
      }),
    );
    renderLogin(login);

    await fillAndSubmit("sarah@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Identifiants invalides.",
    );
  });

  it("maps a backend field error onto the matching input", async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        code: "validation_error",
        message: "Les données envoyées sont invalides.",
        status: 400,
        fieldErrors: { email: ["Adresse e-mail inconnue."] },
      }),
    );
    renderLogin(login);

    await fillAndSubmit("sarah@example.com", "TestPass!2345");

    expect(
      await screen.findByText("Adresse e-mail inconnue."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("validates client-side before calling the API", async () => {
    const login = vi.fn();
    renderLogin(login);

    await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText(/adresse e-mail est requise/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without a round-trip", async () => {
    const login = vi.fn();
    renderLogin(login);

    await fillAndSubmit("not-an-email", "TestPass!2345");

    expect(await screen.findByText(/adresse e-mail invalide/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows a friendly French message when the network is unreachable", async () => {
    const login = vi.fn().mockRejectedValue(
      new ApiError({
        code: "network_error",
        message: "Impossible de contacter le serveur. Vérifiez votre connexion.",
        status: 0,
      }),
    );
    renderLogin(login);

    await fillAndSubmit("sarah@example.com", "TestPass!2345");

    expect(await screen.findByRole("alert")).toHaveTextContent(/connexion/i);
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolve: ((user: CurrentUser) => void) | undefined;
    const login = vi.fn().mockReturnValue(
      new Promise<CurrentUser>((r) => {
        resolve = r;
      }),
    );
    renderLogin(login);

    await fillAndSubmit("sarah@example.com", "TestPass!2345");

    const button = screen.getByRole("button", { name: /se connecter/i });
    await waitFor(() => expect(button).toBeDisabled());

    // Settle the pending promise inside act so the resulting state update
    // is flushed before the test ends.
    await act(async () => {
      resolve?.(makeUser("PARENT"));
    });
  });
});
