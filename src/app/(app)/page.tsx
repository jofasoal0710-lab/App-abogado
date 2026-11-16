import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { Badge, EmptyState, Stat } from "@/components/ui";
import { db } from "@/db";
import { clients, events, invoices, matters, timeEntries, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { invoiceAccessSql, matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { loadAdjustments } from "@/lib/invoice-queries";
import { summarizeInvoice } from "@/lib/invoices";
import { areaLabels, matterStatusLabels } from "@/lib/labels";
import { formatDuration, formatMoney } from "@/lib/money";
import { EventsList } from "./agenda/events-list";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  const today = todayISO();
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const in14Days = new Date(startOfToday.getTime() + 14 * 86_400_000);
  const in7Days = new Date(startOfToday.getTime() + 7 * 86_400_000);
  const mineEvents = (extra?: ReturnType<typeof and>) => and(eq(events.assignedId, user.id), eq(events.completed, false), matterAccessSql(user, events.matterId, { orNone: true }), extra);

  const [[activeCount], [unbilled], [overdueEvents], [week], upcoming, recentMatters, emitted] = await Promise.all([
    db
      .select({ n: count() })
      .from(matters)
      .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id))),
    db
      .select({
        minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int`,
        cents: sql<number>`coalesce(sum(round(${timeEntries.minutes} * ${timeEntries.rateCents} / 60.0)), 0)::int`,
      })
      .from(timeEntries)
      .innerJoin(matters, eq(matters.id, timeEntries.matterId))
      .where(and(eq(timeEntries.billable, true), isNull(timeEntries.invoiceId), eq(matters.billingType, "por_horas"), matterAccessSql(user, matters.id))),
    db
      .select({ n: count() })
      .from(events)
      .where(mineEvents(and(lt(events.startsAt, startOfToday), inArray(events.kind, ["plazo", "tarea"])))),
    db.select({ n: count() }).from(events).where(mineEvents(and(gte(events.startsAt, startOfToday), lt(events.startsAt, in7Days)))),
    db
      .select(eventSelect)
      .from(events)
      .leftJoin(matters, eq(matters.id, events.matterId))
      .leftJoin(users, eq(users.id, events.assignedId))
      .where(mineEvents(and(gte(events.startsAt, startOfToday), lt(events.startsAt, in14Days))))
      .orderBy(asc(events.startsAt))
      .limit(8),
    db
      .select({
        id: matters.id,
        number: matters.number,
        title: matters.title,
        area: matters.area,
        status: matters.status,
        client: clients.name,
        openedAt: matters.openedAt,
      })
      .from(matters)
      .innerJoin(clients, eq(clients.id, matters.clientId))
      .where(and(eq(matters.responsibleId, user.id), inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id)))
      .orderBy(desc(matters.openedAt), desc(matters.id))
      .limit(6),
    db.query.invoices.findMany({
      where: and(eq(invoices.status, "emitida"), invoiceAccessSql(user)),
      with: { items: true, payments: true, client: true },
      orderBy: asc(invoices.dueDate),
    }),
  ]);

  const adjustments = await loadAdjustments(db, emitted.filter((i) => i.kind === "factura").map((i) => i.id));
  const summaries = emitted.map((inv) => ({ inv, s: summarizeInvoice(inv, today, adjustments.get(inv.id)) }));
  const outstanding = summaries.reduce((sum, x) => sum + x.s.outstandingCents, 0);
  const overdueInvoices = summaries.filter((x) => x.s.overdue);
  const overdueAmount = overdueInvoices.reduce((sum, x) => sum + x.s.outstandingCents, 0);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">Hola, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {error === "forbidden" && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No tienes permiso para acceder a esa sección.
        </p>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Expedientes activos" value={activeCount.n} href="/expedientes" />
        <Stat
          label="Mis plazos (7 días)"
          value={week.n}
          href="/agenda?mios=1"
          tone={overdueEvents.n > 0 ? "danger" : "default"}
          hint={overdueEvents.n > 0 ? `${overdueEvents.n} ${overdueEvents.n === 1 ? "vencido" : "vencidos"} sin completar` : "Todo al día"}
        />
        <Stat label="Horas sin facturar" value={formatMoney(unbilled.cents)} href="/horas?todos=1" hint={formatDuration(unbilled.minutes)} />
        <Stat
          label="Pendiente de cobro"
          value={formatMoney(outstanding)}
          href="/facturas?estado=emitida"
          tone={overdueInvoices.length ? "warn" : "default"}
          hint={overdueInvoices.length ? `${overdueInvoices.length} ${overdueInvoices.length === 1 ? "vencida" : "vencidas"} (${formatMoney(overdueAmount)})` : "Sin facturas vencidas"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">Mi agenda · próximos 14 días</h2>
            <Link href="/agenda?mios=1" className="link text-sm">
              Ver agenda
            </Link>
          </div>
          <EventsList rows={upcoming} returnTo="/" empty="No tienes eventos ni plazos próximos" />
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">Mis expedientes</h2>
            <Link href="/expedientes?mios=1" className="link text-sm">
              Ver todos
            </Link>
          </div>
          {recentMatters.length === 0 ? (
            <EmptyState title="No tienes expedientes asignados" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentMatters.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/expedientes/${m.id}`} className="link">
                      {m.number}
                    </Link>
                    <p className="truncate text-sm text-ink-800">{m.title}</p>
                    <p className="text-xs text-ink-500">
                      {m.client} · {areaLabels[m.area]} · desde {formatDate(m.openedAt)}
                    </p>
                  </div>
                  <Badge kind="matter" value={m.status} label={matterStatusLabels[m.status]} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {overdueInvoices.length > 0 && (
          <section className="card overflow-x-auto lg:col-span-2">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <h2 className="font-serif text-lg font-semibold">Facturas vencidas sin cobrar</h2>
              <Link href="/facturas?estado=vencidas" className="link text-sm">
                Ver todas
              </Link>
            </div>
            <table className="table">
              <tbody>
                {overdueInvoices.slice(0, 5).map(({ inv, s }) => (
                  <tr key={inv.id}>
                    <td>
                      <Link className="link" href={`/facturas/${inv.id}`}>
                        {inv.number}
                      </Link>
                    </td>
                    <td>{inv.client.name}</td>
                    <td className="text-ink-600">Venció el {formatDate(inv.dueDate)}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(s.outstandingCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
