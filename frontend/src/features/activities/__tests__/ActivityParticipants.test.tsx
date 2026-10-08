import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/client";

import { ActivityParticipants } from "../components/ActivityParticipants";
import type { ActivityParticipant } from "../types";

const ACTIVITY_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const LEILA = "cccccccc-0000-0000-0000-000000000001";
const SAMI = "cccccccc-0000-0000-0000-000000000002";

function child(id: string, first: string) {
  return {
    id,
    first_name: first,
    last_name: "Ben Ali",
    full_name: `${first} Ben Ali`,
    date_of_birth: "2024-02-01",
    age_months: 20,
    age_display: "1 an et 8 mois",
    age_group: "TODDLER",
    gender: "F",
    photo_url: null,
    status: "ACTIVE",
    allergies: "",
  };
}

/** The roster the picker offers, and the spies for the two mutations. */
function mockApi(roster = [child(LEILA, "Leila"), child(SAMI, "Sami")]) {
  vi.spyOn(apiClient, "get").mockResolvedValue({
    data: {
      count: roster.length,
      page: 1,
      page_size: 100,
      total_pages: 1,
      results: roster,
    },
  } as never);
  return {
    post: vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} } as never),
    del: vi.spyOn(apiClient, "delete").mockResolvedValue({ data: {} } as never),
  };
}

function renderIt(participants: ActivityParticipant[] = []) {
  render(
    <QueryClientProvider
      client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })}
    >
      <ActivityParticipants activityId={ACTIVITY_ID} participants={participants} />
    </QueryClientProvider>,
  );
}

const participant = (childId: string, first: string): ActivityParticipant => ({
  id: `p-${childId}`,
  child_id: childId,
  first_name: first,
  last_name: "Ben Ali",
  note: "",
});

describe("choosing who took part", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says plainly that an empty activity reaches no family", () => {
    mockApi();
    renderIt([]);

    // The whole point of the feature: no participants means no timeline
    // rows, which means no parent ever sees the activity.
    expect(screen.getByText(/aucune famille ne la voit/i)).toBeInTheDocument();
  });

  it("posts the child ids of everyone ticked", async () => {
    const { post } = mockApi();
    renderIt([]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /leila/i }));
    await user.click(screen.getByRole("button", { name: /sami/i }));
    await user.click(screen.getByRole("button", { name: /ajouter 2 enfants/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe(
      `/activities/${ACTIVITY_ID}/participants/`,
    );
    expect(post.mock.calls[0]?.[1]).toEqual({ child_ids: [LEILA, SAMI] });
  });

  it("does not offer a child who is already taking part", async () => {
    mockApi();
    renderIt([participant(LEILA, "Leila")]);

    // Leila appears as a removable chip, not in the picker.
    expect(await screen.findByRole("button", { name: /sami/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^leila ben ali$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retirer leila/i }),
    ).toBeInTheDocument();
  });

  it("removes a participant through the per-child endpoint", async () => {
    const { del } = mockApi();
    renderIt([participant(LEILA, "Leila")]);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /retirer leila/i }));

    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(del.mock.calls[0]?.[0]).toBe(
      `/activities/${ACTIVITY_ID}/participants/${LEILA}/`,
    );
  });

  it("asks for a selection before the add button does anything", async () => {
    const { post } = mockApi();
    renderIt([]);

    const add = await screen.findByRole("button", {
      name: /sélectionnez un enfant/i,
    });
    expect(add).toBeDisabled();
    await userEvent.setup().click(add);
    expect(post).not.toHaveBeenCalled();
  });

  it("tells staff when the whole roster is already in", async () => {
    mockApi([child(LEILA, "Leila")]);
    renderIt([participant(LEILA, "Leila")]);

    expect(
      await screen.findByText(/participent déjà/i),
    ).toBeInTheDocument();
  });
});
