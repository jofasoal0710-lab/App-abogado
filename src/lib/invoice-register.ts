import "server-only";
import { and, asc, between, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import type { CurrentUser } from "@/lib/auth";
import { csvDate, csvDecimal, csvText, toCsv } from "@/lib/csv";
import { invoiceStatusLabels } from "@/lib/labels";
import { loadAdjustments } from "@/lib/invoice-queries";
import { summarizeInvoice } from "@/lib/invoices";

/** Tope de filas por exportación (y por respuesta: en Netlify una respuesta no puede pasar de ~6 MB). */
export const REGISTER_MAX_ROWS = 20_000;

export type RegisterRow = {
  number: string;
  kind: "factura" | "rectificativa";
  issueDate: string;
  dueDate: string | null;
  clientName: string;
  clientTaxId: string | null;
  matterNumber: string | null;
  taxRate: number;
  withholdingRate: number;
  subtotalCents: number;
  taxCents: number;
  withholdingCents: number;
  totalCents: number;
  status: string;
  paidCents: number;
  outstandingCents: number;
  rectifiesNumber: string | null;
  reason: string | null;
};

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Libro de facturas EMITIDAS (sin borradores) entre dos fechas, solo las que `user` puede ver. */
export async function loadRegister(user: CurrentUser, from: string, to: string, today: string) {
  const found = await db.query.invoices.findMany({
    where: and(ne(invoices.status, "borrador"), between(invoices.issueDate, from, to), invoiceAccessSql(user)),
    with: { client: true, matter: true, rectifies: true, items: true, payments: true },
    orderBy: [asc(invoices.issueDate), asc(invoices.number)],
    limit: REGISTER_MAX_ROWS + 1,
  });
  const truncated = found.length > REGISTER_MAX_ROWS;
  const list = truncated ? found.slice(0, REGISTER_MAX_ROWS) : found;

  const adjustments = await loadAdjustments(db, list.filter((i) => i.kind === "factura").map((i) => i.id));
  const rows: RegisterRow[] = list.map((inv) => {
    const adj = adjustments.get(inv.id);
    const s = summarizeInvoice(inv, today, adj);
    return {
      number: inv.number ?? "",
      kind: inv.kind,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      clientName: inv.client.name,
      clientTaxId: inv.client.taxId,
      matterNumber: inv.matter?.number ?? null,
      taxRate: inv.taxRate,
      withholdingRate: inv.withholdingRate,
      subtotalCents: s.subtotalCents,
      taxCents: s.taxCents,
      withholdingCents: s.withholdingCents,
      totalCents: s.totalCents,
      status: invoiceStatusLabels[inv.status] + (s.rectified ? " (rectificada)" : ""),
      paidCents: s.paidCents,
      outstandingCents: s.outstandingCents,
      rectifiesNumber: inv.rectifies?.number ?? null,
      reason: inv.rectificationReason,
    };
  });

  const sum = (f: (r: RegisterRow) => number) => rows.reduce((t, r) => t + f(r), 0);
  return {
    rows,
    truncated,
    totals: {
      invoices: rows.filter((r) => r.kind === "factura").length,
      rectifications: rows.filter((r) => r.kind === "rectificativa").length,
      subtotalCents: sum((r) => r.subtotalCents),
      taxCents: sum((r) => r.taxCents),
      withholdingCents: sum((r) => r.withholdingCents),
      totalCents: sum((r) => r.totalCents),
    },
  };
}

export function registerToCsv(rows: RegisterRow[]): string {
  return toCsv(
    [
      "Número", "Tipo", "Fecha", "Vencimiento", "Cliente", "Identificación", "Expediente", "Base imponible", "% IVA", "Cuota IVA",
      "% Retención", "Retención (importe retenido)", "Total", "Estado", "Cobrado", "Pendiente de cobro", "Rectifica a", "Motivo de la rectificación",
    ],
    rows.map((r) => [
      csvText(r.number),
      r.kind === "rectificativa" ? "Rectificativa" : "Factura",
      csvDate(r.issueDate),
      csvDate(r.dueDate),
      csvText(r.clientName),
      csvText(r.clientTaxId),
      csvText(r.matterNumber),
      csvDecimal(r.subtotalCents),
      String(r.taxRate),
      csvDecimal(r.taxCents),
      String(r.withholdingRate),
      csvDecimal(r.withholdingCents),
      csvDecimal(r.totalCents),
      csvText(r.status),
      csvDecimal(r.paidCents),
      csvDecimal(r.outstandingCents),
      csvText(r.rectifiesNumber),
      csvText(r.reason),
    ]),
  );
}
