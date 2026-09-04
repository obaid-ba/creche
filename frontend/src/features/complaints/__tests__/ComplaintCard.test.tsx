import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { AuthContext, type AuthContextValue } from "@/features/auth/AuthContext";
import type { CurrentUser, Role } from "@/types/api";

import { ComplaintCard } from "../components/ComplaintCard";
import type { Complaint } from "../types";

function makeComplaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "c1",
    subject: "Horaires du soir",
    message: "Serait-il possible d'ajuster l'heure de sortie ?",
    status: "NEW",
    status_label: "Nouvelle",
    parent: {
      id: "p1",
      first_name: "Sarah",
      last_name: "Benali",
      email: "s@b.co",
    },
    child: { id: "ch1", first_name: "Mohamed", last_name: "Benali" },
    replies: [],
    allowed_transitions: [],
    resolved_at: null,
    created_at: "2026-09-04T09:00:00Z",
    updated_at: "2026-09-04T09:00:00Z",
    ...overrides,
  };
}

function renderAs(role: Role, complaint: Complaint) {
  const user: CurrentUser = {
    id: "u1",
    email: "a@b.co",
    first_name: "A",
    last_name: "B",
    phone: "",
    role,
    children: [],
    can_send_messages: true,
  };
  const value: AuthContextValue = {
    user,
    role,
    isAuthenticated: true,
    isBootstrapping: false,
    login: async () => user,
    claim: async () => user,
    logout: async () => undefined,
    refreshUser: async () => undefined,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  return render(<ComplaintCard complaint={complaint} />, { wrapper });
}

describe("ComplaintCard", () => {
  it("shows the subject, status and message", () => {
    renderAs("PARENT", makeComplaint());

    expect(screen.getByText("Horaires du soir")).toBeInTheDocument();
    expect(screen.getByText("Nouvelle")).toBeInTheDocument();
    expect(screen.getByText(/ajuster l'heure de sortie/)).toBeInTheDocument();
  });

  it("offers only the transitions the server allows", () => {
    renderAs(
      "STAFF",
      makeComplaint({ allowed_transitions: ["IN_PROGRESS", "CLOSED"] }),
    );

    expect(screen.getByRole("button", { name: "En cours" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clôturée" })).toBeInTheDocument();
    // NEW -> RESOLVED is not a legal move, so it must not be offered.
    expect(screen.queryByRole("button", { name: "Résolue" })).not.toBeInTheDocument();
  });

  it("offers no status buttons to a parent", () => {
    renderAs("PARENT", makeComplaint({ allowed_transitions: [] }));

    for (const label of ["En cours", "Résolue", "Clôturée"]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  it("shows the parent's name to staff only", () => {
    const complaint = makeComplaint();
    const { unmount } = renderAs("STAFF", complaint);
    expect(screen.getByText(/Sarah Benali/)).toBeInTheDocument();
    unmount();

    renderAs("PARENT", complaint);
    expect(screen.queryByText(/Sarah Benali/)).not.toBeInTheDocument();
  });

  it("marks an internal note distinctly for staff", () => {
    renderAs(
      "STAFF",
      makeComplaint({
        replies: [
          {
            id: "r1",
            body: "Vérifier avec l'équipe du soir.",
            author: { id: "u2", first_name: "Amina", last_name: "S", role: "STAFF" },
            is_internal: true,
            created_at: "2026-09-04T10:00:00Z",
          },
        ],
      }),
    );

    expect(screen.getByText(/note interne/i)).toBeInTheDocument();
  });

  it("offers the internal-note checkbox to staff only", () => {
    const complaint = makeComplaint();
    const { unmount } = renderAs("STAFF", complaint);
    screen.getByRole("button", { name: /répondre/i }).click();
    unmount();

    renderAs("PARENT", complaint);
    expect(
      screen.queryByLabelText(/note interne/i),
    ).not.toBeInTheDocument();
  });
});
