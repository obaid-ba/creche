import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/client";

import { RecordPaymentModal } from "../components/RecordPaymentModal";
import type { Invoice } from "../types";

const INVOICE_ID = "inv-0000-0000-0000-000000000001";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    child: "child-1",
    child_name: "Mohamed Ben Ali",
    period: "2026-10-01",
    amount_due: "180.000",
    amount_paid: "0.000",
    balance: "180.000",
    status: "UNPAID",
    status_label: "Impayée",
    due_date: "2026-10-10",
    payments: [],
    ...overrides,
  };
}

function renderModal(data = invoice()) {
  const post = vi.spyOn(apiClient, "post").mockResolvedValue({
    data: invoice({ amount_paid: "180.000", balance: "0.000", status: "PAID" }),
  } as never);
  const onClose = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })}
    >
      <RecordPaymentModal invoice={data} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { post, onClose };
}

describe("recording a payment", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults to the outstanding balance, which is the usual case", () => {
    renderModal();
    expect(screen.getByLabelText(/montant/i)).toHaveValue("180.000");
  });

  it("posts the amount as an exact string, not a float", async () => {
    const { post } = renderModal();

    await userEvent.setup().click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe(`/invoices/${INVOICE_ID}/payments/`);
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    // A string: 180.000 through a JSON number is not guaranteed to come
    // back as 180.000.
    expect(body.amount).toBe("180.000");
    expect(typeof body.amount).toBe("string");
    expect(body.method).toBe("CASH");
  });

  it("allows a partial payment, since paying in two goes is normal", async () => {
    const { post } = renderModal();
    const user = userEvent.setup();

    const field = screen.getByLabelText(/montant/i);
    await user.clear(field);
    await user.type(field, "60,500");
    await user.click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    await waitFor(() => expect(post).toHaveBeenCalled());
    // The comma a French keyboard produces is normalised, not rejected.
    expect((post.mock.calls[0]?.[1] as Record<string, unknown>).amount).toBe(
      "60.500",
    );
  });

  it("refuses an amount with more precision than a millime", async () => {
    const { post } = renderModal();
    const user = userEvent.setup();

    const field = screen.getByLabelText(/montant/i);
    await user.clear(field);
    await user.type(field, "10.5555");
    await user.click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a date in the future before making the request", async () => {
    const { post } = renderModal();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/reçu le/i));
    await user.type(screen.getByLabelText(/reçu le/i), "2099-01-01");
    await user.click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("closes only once the server has accepted", async () => {
    const { onClose } = renderModal();

    await userEvent.setup().click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("leaves the dialog open and says so when the request fails", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    render(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { mutations: { retry: false } },
        })}
      >
        <RecordPaymentModal invoice={invoice()} onClose={onClose} />
      </QueryClientProvider>,
    );

    await userEvent.setup().click(
      screen.getByRole("button", { name: /enregistrer un paiement/i }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
