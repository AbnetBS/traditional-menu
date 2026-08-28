/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SPLIT BILLING — pure payment/settlement calculations (V1)
 * ═══════════════════════════════════════════════════════════════════════════
 *  Settlement-only: ONE operational ticket = ONE order; splitting affects only
 *  how the bill is PAID. No cloned orders, no seats, no refunds, no change.
 *
 *  The server is authoritative: remaining is ALWAYS derived from the current
 *  ticket total and the stored active payments — never trusted from a client.
 *  Money is integer ETB (the project's existing representation).
 */

export const SPLIT_PAYMENT_METHODS = ["cash", "telebirr", "cbe", "card", "online"] as const;
export type SplitMethod = (typeof SPLIT_PAYMENT_METHODS)[number];

export interface SplitPaymentRow {
  id?: number;
  ticketId: number;
  amount: number;
  method: string;
  status: string; // active | void
  receiptImage?: string | null;
  reference?: string | null;
  recordedBy?: string | null;
  idempotencyKey?: string | null;
}

export const isActivePayment = (p: SplitPaymentRow) => p.status !== "void";

/** Sum of active payments only (voided excluded). */
export function paidAmount(payments: SplitPaymentRow[]): number {
  return payments.filter(isActivePayment).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

/** { total, paid, remaining } — remaining floored at 0, never negative. */
export function computeBalance(total: number, payments: SplitPaymentRow[]) {
  const totalAmt = Math.max(0, Math.round(Number(total) || 0));
  const paid = paidAmount(payments);
  return { total: totalAmt, paid, remaining: Math.max(0, totalAmt - paid) };
}

/**
 * Even split into `n` integer parts that sum EXACTLY to `total` (no money lost
 * or created). The remainder is distributed one ETB at a time to the first parts.
 */
export function splitEven(total: number, n: number): number[] {
  const t = Math.max(0, Math.round(Number(total) || 0));
  const count = Math.max(1, Math.floor(Number(n) || 1));
  const base = Math.floor(t / count);
  const remainder = t - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export interface PayableTicket {
  id: number;
  status: string;
  totalAmount: number | null;
}

/**
 * Validate a new payment against the CURRENT DB state. Returns an error string
 * or null when acceptable. Amount must be a positive integer not exceeding the
 * server-computed remaining balance; cancelled/paid tickets cannot be paid.
 */
export function validatePayment(
  ticket: PayableTicket,
  payments: SplitPaymentRow[],
  amount: number,
  method: string
): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "Amount must be a positive whole number.";
  if (!(SPLIT_PAYMENT_METHODS as readonly string[]).includes(method)) return "Unsupported payment method.";
  if (ticket.status === "cancelled") return "Cancelled tickets cannot receive payments.";
  if (ticket.status === "paid") return "Ticket is already fully paid.";
  const { remaining } = computeBalance(ticket.totalAmount ?? 0, payments);
  if (amount > remaining) return `Payment exceeds the remaining balance (${remaining} ETB).`;
  return null;
}

/** Map a settlement method to the ticket's legacy single paymentStatus value. */
export function methodToPaymentStatus(method: string): string {
  switch (method) {
    case "cash": return "paid_cash";
    case "telebirr": return "paid_telebirr";
    case "cbe": return "paid_cbe";
    case "card": return "paid_card";
    default: return "paid_card";
  }
}
