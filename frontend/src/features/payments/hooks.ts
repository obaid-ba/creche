import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentsApi, type InvoiceListParams } from "./api";
import type { RecordPaymentInput } from "./types";

export const paymentKeys = {
  all: ["payments"] as const,
  invoices: () => [...paymentKeys.all, "invoices"] as const,
  invoiceList: (params: InvoiceListParams) =>
    [...paymentKeys.invoices(), params] as const,
  fees: (child: string) => [...paymentKeys.all, "fees", child] as const,
};

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: paymentKeys.invoiceList(params),
    queryFn: () => paymentsApi.listInvoices(params),
    placeholderData: (previous) => previous,
  });
}

export function useChildFees(child: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.fees(child ?? ""),
    queryFn: () => paymentsApi.listFees(child as string),
    enabled: child !== undefined && child !== "",
  });
}

/** Every write invalidates the whole money tree: a payment changes an
 *  invoice's balance and status, and nothing else in the app derives from
 *  it, so there is no cheaper correct invalidation. */
function useMoneyInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: paymentKeys.all });
  };
}

export function useGenerateInvoices() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: ({ period, dueDay }: { period: string; dueDay?: number }) =>
      paymentsApi.generate(period, dueDay),
    onSuccess: invalidate,
  });
}

export function useRecordPayment(invoiceId: string) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      paymentsApi.recordPayment(invoiceId, input),
    onSuccess: invalidate,
  });
}

export function useCancelInvoice(invoiceId: string) {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: (reason: string) =>
      paymentsApi.cancelInvoice(invoiceId, reason),
    onSuccess: invalidate,
  });
}

export function useVoidPayment() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentsApi.voidPayment(id, reason),
    onSuccess: invalidate,
  });
}

export function useSetFee() {
  const invalidate = useMoneyInvalidation();
  return useMutation({
    mutationFn: paymentsApi.setFee,
    onSuccess: invalidate,
  });
}
