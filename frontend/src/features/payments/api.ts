import { apiClient } from "@/services/client";
import type { PageResponse } from "@/types/api";

import type {
  ChildFee,
  GenerationResult,
  Invoice,
  Payment,
  RecordPaymentInput,
} from "./types";

export interface InvoiceListParams {
  /** Any date in the month; the server snaps it to the first. */
  period?: string;
  from?: string;
  to?: string;
  child?: string;
  page?: number;
}

function clean(params: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") out[key] = String(value);
  }
  return out;
}

export const paymentsApi = {
  async listInvoices(
    params: InvoiceListParams,
  ): Promise<PageResponse<Invoice>> {
    const { data } = await apiClient.get<PageResponse<Invoice>>("/invoices/", {
      params: clean(params),
    });
    return data;
  },

  /** Issues the month's invoices for every active child. Idempotent. */
  async generate(period: string, dueDay = 10): Promise<GenerationResult> {
    const { data } = await apiClient.post<GenerationResult>(
      "/invoices/generate/",
      { period, due_day: dueDay },
    );
    return data;
  },

  /** Returns the whole invoice, so the caller gets the new balance back. */
  async recordPayment(
    invoiceId: string,
    input: RecordPaymentInput,
  ): Promise<Invoice> {
    const { data } = await apiClient.post<Invoice>(
      `/invoices/${invoiceId}/payments/`,
      input,
    );
    return data;
  },

  async cancelInvoice(invoiceId: string, reason: string): Promise<Invoice> {
    const { data } = await apiClient.post<Invoice>(
      `/invoices/${invoiceId}/cancel/`,
      { reason },
    );
    return data;
  },

  /** A void keeps the row and the reason; nothing here deletes money. */
  async voidPayment(paymentId: string, reason: string): Promise<Payment> {
    const { data } = await apiClient.post<Payment>(
      `/payments/${paymentId}/void/`,
      { reason },
    );
    return data;
  },

  async listFees(child: string): Promise<PageResponse<ChildFee>> {
    const { data } = await apiClient.get<PageResponse<ChildFee>>("/fees/", {
      params: { child },
    });
    return data;
  },

  async setFee(input: {
    child: string;
    monthly_amount: string;
    effective_from: string;
    note?: string;
  }): Promise<ChildFee> {
    const { data } = await apiClient.post<ChildFee>("/fees/", input);
    return data;
  },
};
