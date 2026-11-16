import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoiceItems, invoices, payments } from "@/db/schema";
import { NO_ADJUSTMENT, type Adjustment } from "./invoices";
import { invoiceTotals } from "./money";

/** Acepta tanto `db` como una transacción. */
export type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Para cada factura original, lo que suman sus rectificativas EMITIDAS (normalmente negativo).
 * Una rectificativa en borrador todavía no cuenta.
 */
export async function loadAdjustments(dbx: Db, originalIds: number[]): Promise<Map<number, Adjustment>> {
  const result = new Map<number, Adjustment>();
  if (originalIds.length === 0) return result;

  const rects = await dbx
    .select({ id: invoices.id, original: invoices.rectifiesInvoiceId, taxRate: invoices.taxRate, withholdingRate: invoices.withholdingRate })
    .from(invoices)
    .where(and(inArray(invoices.rectifiesInvoiceId, originalIds), eq(invoices.kind, "rectificativa"), eq(invoices.status, "emitida")));
  if (rects.length === 0) return result;

  const items = await dbx.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, rects.map((r) => r.id)));
  for (const r of rects) {
    const total = invoiceTotals(items.filter((i) => i.invoiceId === r.id), r.taxRate, r.withholdingRate).totalCents;
    const cur = result.get(r.original!) ?? NO_ADJUSTMENT;
    result.set(r.original!, { cents: cur.cents + total, count: cur.count + 1 });
  }
  return result;
}

/** Total neto de una factura original: lo que dice + lo que corrigen sus rectificativas emitidas. */
export async function netTotal(dbx: Db, invoiceId: number): Promise<number | null> {
  const [inv] = await dbx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return null;
  const items = await dbx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  const adj = (await loadAdjustments(dbx, [invoiceId])).get(invoiceId)?.cents ?? 0;
  return invoiceTotals(items, inv.taxRate, inv.withholdingRate).totalCents + adj;
}

/**
 * Tras un cobro, una rectificativa o un cobro borrado: si el neto de la factura está cubierto pasa a
 * «pagada», y si deja de estarlo vuelve a «emitida». Con neto 0 (abono total) no se cambia el estado.
 */
export async function reconcileStatus(dbx: Db, invoiceId: number): Promise<void> {
  const [inv] = await dbx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv || inv.kind !== "factura" || (inv.status !== "emitida" && inv.status !== "pagada")) return;

  const paid = (await dbx.select({ a: payments.amountCents }).from(payments).where(eq(payments.invoiceId, invoiceId))).reduce((s, p) => s + p.a, 0);
  const net = (await netTotal(dbx, invoiceId)) ?? 0;
  if (net <= 0) return;

  const next = paid >= net ? "pagada" : "emitida";
  if (next !== inv.status) await dbx.update(invoices).set({ status: next }).where(eq(invoices.id, invoiceId));
}
