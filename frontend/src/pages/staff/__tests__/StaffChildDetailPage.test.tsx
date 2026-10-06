import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/features/auth/AuthContext";
import type { AuthContextValue } from "@/features/auth/AuthContext";
import { apiClient } from "@/services/client";

import { StaffChildDetailPage } from "../StaffChildDetailPage";

/**
 * A guardianship row and the parent it points at have *different* ids,
 * and both are UUID strings. The reissue endpoint looks the guardianship
 * up by parent, so sending `guardian.id` type-checks perfectly and 404s
 * at runtime — with no error shown, because the page only read
 * `isPending`. These two ids must stay distinguishable here or the test
 * cannot tell the bug from the fix.
 */
const GUARDIANSHIP_ID = "11111111-1111-1111-1111-111111111111";
const PARENT_ID = "22222222-2222-2222-2222-222222222222";
const CHILD_ID = "33333333-3333-3333-3333-333333333333";

const child = {
  id: CHILD_ID,
  first_name: "Mohamed",
  last_name: "Ben Ali",
  full_name: "Mohamed Ben Ali",
  date_of_birth: "2024-01-15",
  age_months: 20,
  age_display: "1 an et 8 mois",
  age_group: "TODDLER",
  gender: "M",
  photo: null,
  photo_url: null,
  registration_date: "2025-09-01",
  allergies: "",
  medical_notes: "",
  notes: "",
  status: "ACTIVE",
  archived_at: null,
  has_active_access_code: false,
  created_at: "2025-09-01T08:00:00Z",
  updated_at: "2025-09-01T08:00:00Z",
  guardians: [
    {
      id: GUARDIANSHIP_ID,
      parent_id: PARENT_ID,
      first_name: "Leila",
      last_name: "Ben Ali",
      email: "",
      phone: "99 111 222",
      relationship: "MOTHER",
      is_primary: true,
    },
  ],
};

function renderPage() {
  const auth = { role: "ADMIN", isAuthenticated: true } as AuthContextValue;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/staff/children/${CHILD_ID}`]}>
          <Routes>
            <Route
              path="/staff/children/:childId"
              element={<StaffChildDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

/** The child always loads; only the reissue POST differs per test. */
function mockApi(post: "ok" | "fail") {
  vi.spyOn(apiClient, "get").mockResolvedValue({ data: child } as never);
  const spy = vi.spyOn(apiClient, "post");
  if (post === "ok") {
    spy.mockResolvedValue({
      data: {
        code: "MAM-7F42-K9QX",
        hint: "MAM-\u2026-K9QX",
        parent_id: PARENT_ID,
        parent_name: "Leila Ben Ali",
        child_name: "Mohamed",
      },
    } as never);
  } else {
    spy.mockRejectedValue(new Error("boom"));
  }
  return spy;
}

async function clickReissue() {
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: /nouveau code/i }));
}

describe("reissuing an access code", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the parent id, not the guardianship id", async () => {
    const post = mockApi("ok");
    renderPage();
    await clickReissue();

    await waitFor(() => expect(post).toHaveBeenCalled());
    const url = post.mock.calls[0]?.[0] as string;

    expect(url, "must address the guardian by parent id").toContain(PARENT_ID);
    expect(url, "the guardianship id would 404").not.toContain(GUARDIANSHIP_ID);
  });

  it("shows the code once it is issued", async () => {
    mockApi("ok");
    renderPage();
    await clickReissue();

    expect(await screen.findByText("MAM-7F42-K9QX")).toBeInTheDocument();
  });

  it("says so when the reissue fails, rather than looking like a dead button", async () => {
    mockApi("fail");
    renderPage();
    await clickReissue();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
