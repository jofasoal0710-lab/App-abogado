import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, matterExpenses, matters, payments, timeEntries, users } from "@/db/schema";
import { invoiceAccessSql, matterAccessSql } from "./access";
import type { CurrentUser } from "./auth";
import { loadAdjustments } from "./invoice-queries";
import { summarizeInvoice } from "./invoices";
import { areaLabels } from "./labels";
import { AGING_BUCKETS, agingBucket, daysOverdue, groupSum, hoursValueCents, type AgingBucket, type Period } from "./report-calc";

/**
 * Reportes del despacho. TODO pasa por las reglas de acceso: un expediente confidencial o restringido solo
 * cuenta para quien puede verlo (también en los totales), igual que en el resto de la app.
 */

const areaName = (a: string | null | undefined) => (a ? (areaLabels as Record<string, string>)[a] ?? a : "Sin expediente");

/* ---------------- Horas ---------------- */

export type HoursRow = { userId: number; name: string; minutes: number; billableMinutes: number; invoicedMinutes: number; valueCents: number };

/** Horas por persona en el periodo. Con `onlyUserId`, solo las de esa persona («Mis horas»). */
export async function hoursByPerson(user: CurrentUser, p: Period, onlyUserId?: number): Promise<HoursRow[]> {
  const rows = await db
    .select({
      userId: timeEntries.userId,
      name: users.name,
      minutes: timeEntries.minutes,
      billable: timeEntries.billable,
      invoiced: sql<boolean>`${timeEntries.invoiceId} is not null`,
      rateCents: timeEntries.rateCents,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(and(gte(timeEntries.workedOn, p.from), lte(timeEntries.workedOn, p.to), matterAccessSql(user, timeEntries.matterId), onlyUserId ? eq(timeEntries.userId, onlyUserId) : undefined));
  const out = new Map<number, HoursRow>();
  for (const r of rows) {
    const acc = out.get(r.userId) ?? { userId: r.userId, name: r.name, minutes: 0, billableMinutes: 0, invoicedMinutes: 0, valueCents: 0 };
    acc.minutes += r.minutes;
    if (r.billable) {
      acc.billableMinutes += r.minutes;
      acc.valueCents += hoursValueCents(r.minutes, r.rateCents);
    }
    if (r.invoiced) acc.invoicedMinutes += r.minutes;
    out.set(r.userId, acc);
  }
  return [...out.values()].sort((a, b) => b.minutes - a.minutes);
}

/* ---------------- Facturación ---------------- */

type InvoiceSummary = { id: number; number: string | null; client: string; area: string; issueDate: string; dueDate: string | null; netCents: number; paidCents: number; outstandingCents: number };

async function summarize(user: CurrentUser, where: ReturnType<typeof and>, today: string): Promise<InvoiceSummary[]> {
  const ids = (await db.select({ id: invoices.id }).from(invoices).where(and(where, eq(invoices.kind, "factura"), invoiceAccessSql(user)))).map((r) => r.id);
  if (!ids.length) return [];
  const rows = await db.query.invoices.findMany({ where: (i, { inArray: inA }) => inA(i.id, ids), with: { client: true, items: true, payments: true, matter: true } });
  const adj = await loadAdjustments(db, ids);
  return rows.map((inv) => {
    const s = summarizeInvoice(inv, today, adj.get(inv.id));
    return { id: inv.id, number: inv.number, client: inv.client.name, area: areaName(inv.matter?.area), issueDate: inv.issueDate, dueDate: inv.dueDate, netCents: s.netTotalCents, paidCents: s.paidCents, outstandingCents: s.outstandingCents };
  });
}

/** Facturas emitidas en el periodo (netas de rectificativas), agrupadas por cliente y por materia. */
export async function billing(user: CurrentUser, p: Period, today: string) {
  const list = await summarize(user, and(inArray(invoices.status, ["emitida", "pagada"]), gte(invoices.issueDate, p.from), lte(invoices.issueDate, p.to)), today);
  const fields = { invoiced: (r: InvoiceSummary) => r.netCents, paid: (r: InvoiceSummary) => r.paidCents, outstanding: (r: InvoiceSummary) => r.outstandingCents, count: () => 1 };
  return {
    count: list.length,
    invoicedCents: list.reduce((s, r) => s + r.netCents, 0),
    outstandingCents: list.reduce((s, r) => s + r.outstandingCents, 0),
    byClient: groupSum(list, (r) => r.client, fields, "invoiced"),
    byArea: groupSum(list, (r) => r.area, fields, "invoiced"),
  };
}

/** Cobros recibidos en el periodo (por fecha de pago), en facturas que el usuario puede ver. */
export async function collections(user: CurrentUser, p: Period) {
  const [r] = await db
    .select({ cents: sql<string>`coalesce(sum(${payments.amountCents}), 0)`, n: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(gte(payments.paidAt, p.from), lte(payments.paidAt, p.to), invoiceAccessSql(user)));
  return { cents: Number(r.cents), count: r.n };
}

/* ---------------- Cartera pendiente ---------------- */

export type AgingRow = { client: string } & Record<AgingBucket, number> & { total: number; oldestDays: number };

/** Todo lo pendiente de cobro hoy (cualquier fecha de emisión), por cliente y antigüedad. */
export async function aging(user: CurrentUser, today: string) {
  const list = (await summarize(user, eq(invoices.status, "emitida"), today)).filter((r) => r.outstandingCents > 0);
  const map = new Map<string, AgingRow>();
  const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
  for (const r of list) {
    const ref = r.dueDate ?? r.issueDate;
    const b = agingBucket(ref, today);
    const row = map.get(r.client) ?? ({ client: r.client, ...Object.fromEntries(AGING_BUCKETS.map((x) => [x, 0])), total: 0, oldestDays: 0 } as AgingRow);
    row[b] += r.outstandingCents;
    row.total += r.outstandingCents;
    row.oldestDays = Math.max(row.oldestDays, daysOverdue(ref, today));
    map.set(r.client, row);
    totals[b] += r.outstandingCents;
  }
  return { rows: [...map.values()].sort((a, b) => b.total - a.total), totals, totalCents: list.reduce((s, r) => s + r.outstandingCents, 0), invoices: list.length };
}

/* ---------------- Expedientes y rentabilidad por materia ---------------- */

export async function mattersByArea(user: CurrentUser, p: Period) {
  const rows = await db
    .select({ area: matters.area, status: matters.status, createdAt: matters.createdAt, closedAt: matters.closedAt })
    .from(matters)
    .where(matterAccessSql(user, matters.id));
  const from = new Date(`${p.from}T00:00:00`), to = new Date(`${p.to}T23:59:59`);
  return groupSum(
    rows,
    (r) => areaName(r.area),
    {
      active: (r) => (r.status !== "cerrado" && r.status !== "archivado" ? 1 : 0),
      opened: (r) => (r.createdAt >= from && r.createdAt <= to ? 1 : 0),
      closed: (r) => (r.closedAt && r.closedAt >= p.from && r.closedAt <= p.to ? 1 : 0),
    },
    "active",
  );
}

/** Por materia: valor de las horas trabajadas, lo facturado y los gastos del periodo, y la realización (facturado ÷ valor de horas). */
export async function profitabilityByArea(user: CurrentUser, p: Period, today: string) {
  const hours = await db
    .select({ area: matters.area, minutes: timeEntries.minutes, rateCents: timeEntries.rateCents, billable: timeEntries.billable })
    .from(timeEntries)
    .innerJoin(matters, eq(matters.id, timeEntries.matterId))
    .where(and(gte(timeEntries.workedOn, p.from), lte(timeEntries.workedOn, p.to), matterAccessSql(user, timeEntries.matterId)));
  const expenses = await db
    .select({ area: matters.area, cents: matterExpenses.amountCents })
    .from(matterExpenses)
    .innerJoin(matters, eq(matters.id, matterExpenses.matterId))
    .where(and(gte(matterExpenses.spentOn, p.from), lte(matterExpenses.spentOn, p.to), matterAccessSql(user, matterExpenses.matterId)));
  const bill = await billing(user, p, today);
  const areas = new Map<string, { area: string; minutes: number; hoursValueCents: number; invoicedCents: number; expensesCents: number }>();
  const get = (a: string) => areas.get(a) ?? { area: a, minutes: 0, hoursValueCents: 0, invoicedCents: 0, expensesCents: 0 };
  for (const h of hours) {
    const x = get(areaName(h.area));
    x.minutes += h.minutes;
    if (h.billable) x.hoursValueCents += hoursValueCents(h.minutes, h.rateCents);
    areas.set(x.area, x);
  }
  for (const e of expenses) {
    const x = get(areaName(e.area));
    x.expensesCents += Number(e.cents);
    areas.set(x.area, x);
  }
  for (const b of bill.byArea) {
    const x = get(b.key);
    x.invoicedCents += b.invoiced;
    areas.set(x.area, x);
  }
  return [...areas.values()].sort((a, b) => b.invoicedCents - a.invoicedCents || b.hoursValueCents - a.hoursValueCents);
}

