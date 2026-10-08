/**
 * Money arrives as a **string**, never a number.
 *
 * The dinar divides into 1000 millimes, and JSON numbers are IEEE-754
 * doubles: `180.000 - 60.000 - 60.000 - 60.000` is not reliably zero once
 * it has been through a float. DRF serialises Decimal as a string for
 * exactly this reason, and the server is the only thing that does
 * arithmetic on it. Here it is formatted for display and parsed only when
 * a number is typed into a form.
 */
export type Money = string;

export type PaymentMethod = "CASH" | "TRANSFER" | "CHEQUE" | "OTHER";

export type InvoiceStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Payment {
  id: string;
  invoice?: string;
  amount: Money;
  method: PaymentMethod;
  method_label: string;
  received_on: string;
  reference: string;
  note?: string;
  is_voided: boolean;
  voided_at?: string | null;
  voided_reason?: string;
  recorded_by_name?: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  child: string;
  child_name: string;
  /** First day of the month billed. */
  period: string;
  amount_due: Money;
  amount_paid: Money;
  /** Negative when a family has overpaid. */
  balance: Money;
  status: InvoiceStatus;
  status_label: string;
  due_date: string;
  note?: string;
  cancelled_at?: string | null;
  cancelled_reason?: string;
  payments: Payment[];
  created_at?: string;
}

export interface ChildFee {
  id: string;
  child: string;
  child_name: string;
  monthly_amount: Money;
  effective_from: string;
  note: string;
  created_at?: string;
}

export interface RecordPaymentInput {
  amount: string;
  method: PaymentMethod;
  received_on: string;
  reference?: string;
  note?: string;
}

/** What `POST /invoices/generate/` answers. */
export interface GenerationResult {
  created: number;
  already_invoiced: string[];
  no_fee_set: string[];
  invoices: Invoice[];
}

export const METHOD_KEYS: Record<PaymentMethod, string> = {
  CASH: "payments.methodCash",
  TRANSFER: "payments.methodTransfer",
  CHEQUE: "payments.methodCheque",
  OTHER: "payments.methodOther",
};

export const STATUS_KEYS: Record<InvoiceStatus, string> = {
  UNPAID: "payments.statusUnpaid",
  PARTIAL: "payments.statusPartial",
  PAID: "payments.statusPaid",
  OVERDUE: "payments.statusOverdue",
  CANCELLED: "payments.statusCancelled",
};
