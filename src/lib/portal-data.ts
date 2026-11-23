import "server-only";
import { and, asc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { documents, events, invoices, matterFunds, matters, payments } from "@/db/schema";
import { fundBalance } from "./funds";
import { netTotal } from "./invoice-queries";

/**
 * Lo que ve un cliente en su portal. SOLO sus expedientes marcados como compartidos; dentro de ellos, solo
 * los documentos compartidos uno a uno, las audiencias pendientes y el saldo de la provisión. Ni notas,
 * ni horas, ni escritos, ni nada de otros clientes.
 */
export async function portalOverview(clientId: number) {
  const ms = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, area: matters.area, status: matters.status, court: matters.court, courtCaseNumber: matters.courtCaseNumber })
    .from(matters)
    .where(and(eq(matters.clientId, clientId), eq(matters.portalShared, true)))
    .orderBy(asc(matters.number));
  const ids = ms.map((m) => m.id);
  const [docs, hearings, funds, invs] = await Promise.all([
    ids.length ? db.select({ id: documents.id, matterId: documents.matterId, name: documents.name, createdAt: documents.createdAt, sizeBytes: documents.sizeBytes }).from(documents).where(and(inArray(documents.matterId, ids), eq(documents.portalShared, true))).orderBy(asc(documents.createdAt)) : [],
    ids.length
      ? db.select({ id: events.id, matterId: events.matterId, title: events.title, startsAt: events.startsAt, location: events.location, hearingType: events.hearingType, hearingMode: events.hearingMode, meetingUrl: events.meetingUrl }).from(events).where(and(inArray(events.matterId, ids), eq(events.kind, "audiencia"), eq(events.completed, false), gte(events.startsAt, new Date()))).orderBy(asc(events.startsAt))
      : [],
    ids.length ? db.select({ matterId: matterFunds.matterId, kind: matterFunds.kind, amountCents: matterFunds.amountCents }).from(matterFunds).where(inArray(matterFunds.matterId, ids)) : [],
    db
      .select({ id: invoices.id, number: invoices.number, issueDate: invoices.issueDate, dueDate: invoices.dueDate, status: invoices.status, matterId: invoices.matterId })
      .from(invoices)
      .where(and(eq(invoices.clientId, clientId), eq(invoices.kind, "factura"), inArray(invoices.status, ["emitida", "pagada"]), ids.length ? or(isNull(invoices.matterId), inArray(invoices.matterId, ids)) : isNull(invoices.matterId)))
      .orderBy(asc(invoices.issueDate)),
  ]);
  const paid = invs.length ? await db.select({ invoiceId: payments.invoiceId, a: payments.amountCents }).from(payments).where(inArray(payments.invoiceId, invs.map((i) => i.id))) : [];
  const invoiceRows = [];
  for (const i of invs) {
    const total = (await netTotal(db, i.id)) ?? 0;
    const p = paid.filter((x) => x.invoiceId === i.id).reduce((s, x) => s + x.a, 0);
    invoiceRows.push({ ...i, totalCents: total, outstandingCents: Math.max(0, total - p) });
  }
  return {
    matters: ms.map((m) => {
      const f = funds.filter((x) => x.matterId === m.id);
      return { ...m, documents: docs.filter((d) => d.matterId === m.id), hearings: hearings.filter((h) => h.matterId === m.id), fundsBalanceCents: f.length ? fundBalance(f) : null };
    }),
    invoices: invoiceRows.reverse(),
  };
}

/** ¿Puede este cliente descargar este documento desde el portal? */
export async function portalDocument(clientId: number, documentId: number) {
  const [d] = await db
    .select({ id: documents.id, name: documents.name, mimeType: documents.mimeType, sizeBytes: documents.sizeBytes, storageKey: documents.storageKey, matterNumber: matters.number })
    .from(documents)
    .innerJoin(matters, eq(matters.id, documents.matterId))
    .where(and(eq(documents.id, documentId), eq(documents.portalShared, true), eq(matters.portalShared, true), eq(matters.clientId, clientId)))
    .limit(1);
  return d ?? null;
}

/** Condición SQL de las facturas que el cliente puede descargar desde el portal (las mismas que ve). */
export async function portalInvoiceAllowed(clientId: number, invoiceId: number): Promise<boolean> {
  const [inv] = await db
    .select({ id: invoices.id, matterId: invoices.matterId, shared: matters.portalShared })
    .from(invoices)
    .leftJoin(matters, eq(matters.id, invoices.matterId))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.clientId, clientId), eq(invoices.kind, "factura"), inArray(invoices.status, ["emitida", "pagada"])))
    .limit(1);
  return !!inv && (inv.matterId === null || inv.shared === true);
}
