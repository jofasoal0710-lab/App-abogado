import { invoiceTotals, type LineItem } from "./money";

export type InvoiceKind = "factura" | "rectificativa";

type InvoiceLike = {
  status: "borrador" | "emitida" | "pagada" | "anulada";
  kind: InvoiceKind;
  taxRate: number;
  withholdingRate: number;
  dueDate: string | null;
  items: LineItem[];
  payments: { amountCents: number }[];
};

/** Lo que las rectificativas EMITIDAS de una factura suman o restan a su total (normalmente negativo). */
export type Adjustment = { cents: number; count: number };
export const NO_ADJUSTMENT: Adjustment = { cents: 0, count: 0 };

/**
 * Resumen económico de una factura.
 *  - total: lo que dice la propia factura (base + IVA − retención de IRPF).
 *  - netTotal: el total una vez aplicadas las rectificativas emitidas que la corrigen.
 *  - outstanding: lo que falta por cobrar del neto. Una rectificativa nunca tiene saldo propio.
 *  - credit: lo cobrado de más (cuando una rectificativa reduce una factura ya cobrada): a devolver o compensar.
 */
export function summarizeInvoice(inv: InvoiceLike, today: string, adjustment: Adjustment = NO_ADJUSTMENT) {
  const totals = invoiceTotals(inv.items, inv.taxRate, inv.withholdingRate);
  const isRectification = inv.kind === "rectificativa";
  const paidCents = inv.payments.reduce((s, p) => s + p.amountCents, 0);

  const netTotalCents = isRectification ? totals.totalCents : totals.totalCents + adjustment.cents;
  const issued = inv.status === "emitida" || inv.status === "pagada";
  const outstandingCents = !isRectification && inv.status === "emitida" ? Math.max(0, netTotalCents - paidCents) : 0;
  const creditCents = !isRectification && issued ? Math.max(0, paidCents - netTotalCents) : 0;
  const overdue = !isRectification && inv.status === "emitida" && !!inv.dueDate && inv.dueDate < today && outstandingCents > 0;

  return { ...totals, paidCents, netTotalCents, outstandingCents, creditCents, overdue, rectified: adjustment.count > 0 };
}
