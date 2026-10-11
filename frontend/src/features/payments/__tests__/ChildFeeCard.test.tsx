import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/client";

import { ChildFeeCard } from "../components/ChildFeeCard";
import type { ChildFee } from "../types";

const CHILD = "child-0000-0000-0000-000000000001";

function fee(overrides: Partial<ChildFee> = {}): ChildFee {
  return {
    id: "fee-1",
    child: CHILD,
    child_name: "Mohamed Ben Ali",
    monthly_amount: "180.000",
    effective_from: "2026-01-01",
    note: "",
    ...overrides,
  };
}

function renderCard(rows: ChildFee[]) {
  vi.spyOn(apiClient, "get").mockResolvedValue({
    data: { count: rows.length, page: 1, page_size: 20, total_pages: 1, results: rows },
  } as never);
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({
    data: fee(),
  } as never);
  render(
    <QueryClientProvider
      client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })}
    >
      <ChildFeeCard childId={CHILD} />
    </QueryClientProvider>,
  );
  return post;
}

describe("setting a child's monthly fee", () => {
  afterEach(() => vi.restoreAllMocks());

  it("warns plainly when no fee exists, because the child is then unbillable", async () => {
    renderCard([]);
    // This is the exact condition that made "Générer les factures"
    // produce nothing at all.
    expect(
      await screen.findByText(/aucune tarif|aucun tarif/i),
    ).toBeInTheDocument();
  });

  it("shows the fee in force", async () => {
    renderCard([fee({ monthly_amount: "180.000" })]);
    expect(await screen.findByText(/tarif actuel/i)).toBeInTheDocument();
    expect(screen.getByText(/180/)).toBeInTheDocument();
  });

  it("treats a future-dated fee as scheduled, not current", async () => {
    renderCard([
      fee({ id: "future", monthly_amount: "200.000", effective_from: "2099-01-01" }),
      fee({ id: "now", monthly_amount: "180.000", effective_from: "2026-01-01" }),
    ]);

    // The one in force is the newest that has already started; the 2099
    // row is listed separately as scheduled. Matched on the month so it
    // cannot collide with the "À partir de" field label.
    expect(await screen.findByText(/tarif actuel/i)).toBeInTheDocument();
    expect(screen.getByText(/janvier 2099/i)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it("posts an exact amount on the first of the chosen month", async () => {
    const post = renderCard([]);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/montant/i), "180,5");
    await user.click(screen.getByRole("button", { name: /enregistrer le tarif/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe("/fees/");
    const body = post.mock.calls[0]?.[1] as Record<string, string>;
    // A comma from the keyboard, normalised to millimes.
    expect(body.monthly_amount).toBe("180.500");
    expect(body.child).toBe(CHILD);
    expect(body.effective_from).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("refuses more precision than a millime", async () => {
    // Priced already, so the only alert on screen is the validation one -
    // the empty-state warning is itself role="alert".
    const post = renderCard([fee()]);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/montant/i), "10.5555");
    await user.click(screen.getByRole("button", { name: /enregistrer le tarif/i }));

    expect(
      await screen.findByText(/trois décimales|montant valide/i),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
