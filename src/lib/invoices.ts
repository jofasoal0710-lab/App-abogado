import { invoiceTotals, type LineItem } from "./money";

type InvoiceLike = {
  status: "borrador" | "emitida" | "pagada" | "anulada";
  taxRate: number;
  dueDate: string | null;
  items: LineItem[];
  payments: { amountCents: number }[];
};

export function summarizeInvoice(inv: InvoiceLike, today: string) {
  const totals = invoiceTotals(inv.items, inv.taxRate);
  const paidCents = inv.payments.reduce((s, p) => s + p.amountCents, 0);
  const outstandingCents = inv.status === "emitida" ? Math.max(0, totals.totalCents - paidCents) : 0;
  const overdue = inv.status === "emitida" && !!inv.dueDate && inv.dueDate < today;
  return { ...totals, paidCents, outstandingCents, overdue };
}
