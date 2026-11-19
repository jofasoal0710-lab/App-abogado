import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { BarList, Columns, Donut } from "@/components/charts";
import { Badge, EmptyState, Stat } from "@/components/ui";
import { db } from "@/db";
import { clients, events, invoices, matters, payments, timeEntries, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { invoiceAccessSql, matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { buildMonthGrid, currentMonth, dayKey, formatDate, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/dates";
import { loadAdjustments } from "@/lib/invoice-queries";
import { summarizeInvoice } from "@/lib/invoices";
import { areaLabels, eventKindLabels, matterStatusLabels } from "@/lib/labels";
import { formatDuration, formatMoney } from "@/lib/money";
import { qs } from "@/lib/search";
import { EventsList } from "./agenda/events-list";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; mes?: string }> }) {
  const user = await requireUser();
  const { error, mes } = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "") ? mes! : currentMonth();
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const thisMonth = currentMonth();
  const chartMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
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

  const ACTIVE = ["abierto", "en_curso", "en_espera"] as const;
  const [byArea, byStatus, paidByMonth, calendarEvents] = await Promise.all([
    db
      .select({ area: matters.area, n: count() })
      .from(matters)
      .where(and(inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id)))
      .groupBy(matters.area),
    db.select({ status: matters.status, n: count() }).from(matters).where(matterAccessSql(user, matters.id)).groupBy(matters.status),
    db
      .select({ month: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`, cents: sql<number>`sum(${payments.amountCents})::int` })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(and(gte(payments.paidAt, `${chartMonths[0]}-01`), invoiceAccessSql(user)))
      .groupBy(sql`1`),
    db
      .select({ id: events.id, kind: events.kind, title: events.title, startsAt: events.startsAt, completed: events.completed })
      .from(events)
      .where(and(gte(events.startsAt, monthStart), lt(events.startsAt, monthEnd), matterAccessSql(user, events.matterId, { orNone: true })))
      .orderBy(asc(events.startsAt)),
  ]);

  const areaCount = new Map(byArea.map((r) => [r.area, r.n]));
  const areaData = (Object.keys(areaLabels) as (keyof typeof areaLabels)[])
    .map((k) => ({ key: k, label: areaLabels[k], value: areaCount.get(k) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const statusCount = new Map(byStatus.map((r) => [r.status, r.n]));
  const statusColors: Record<string, string> = { abierto: "#4f86e0", en_curso: "#1f57b8", en_espera: "#b7791f", cerrado: "#64748b", archivado: "#94a3b8" };
  const statusData = (Object.keys(matterStatusLabels) as (keyof typeof matterStatusLabels)[]).map((k) => ({
    key: k,
    label: matterStatusLabels[k],
    value: statusCount.get(k) ?? 0,
    color: statusColors[k],
    href: `/expedientes?estado=${k}`,
  }));
  const paid = new Map(paidByMonth.map((r) => [r.month, r.cents]));
  const paidData = chartMonths.map((m) => ({ key: m, label: monthLabel(m).slice(0, 3), value: paid.get(m) ?? 0, current: m === thisMonth }));
  const paidTotal = paidData.reduce((s, d) => s + d.value, 0);

  const eventsByDay = new Map<string, typeof calendarEvents>();
  for (const e of calendarEvents) {
    const k = dayKey(e.startsAt);
    eventsByDay.set(k, [...(eventsByDay.get(k) ?? []), e]);
  }
  const weeks = buildMonthGrid(month);

  const adjustments = await loadAdjustments(db, emitted.filter((i) => i.kind === "factura").map((i) => i.id));
  const summaries = emitted.map((inv) => ({ inv, s: summarizeInvoice(inv, today, adjustments.get(inv.id)) }));
  const outstanding = summaries.reduce((sum, x) => sum + x.s.outstandingCents, 0);
  const overdueInvoices = summaries.filter((x) => x.s.overdue);
  const overdueAmount = overdueInvoices.reduce((sum, x) => sum + x.s.outstandingCents, 0);

  const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
  const kindDot: Record<string, string> = { audiencia: "bg-red-500", plazo: "bg-amber-500", reunion: "bg-brand-500", tarea: "bg-ink-400" };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">Hola, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink-500 first-letter:uppercase">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href="/agenda/nuevo" className="btn-secondary">
            Nuevo evento
          </Link>
          <Link href="/expedientes/nuevo" className="btn-primary">
            Nuevo expediente
          </Link>
        </div>
      </div>

      {error === "forbidden" && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No tienes permiso para acceder a esa sección.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Expedientes activos" value={activeCount.n} href="/expedientes" icon="expedientes" />
        <Stat
          label="Mis plazos esta semana"
          value={week.n}
          href="/agenda?mios=1"
          icon={overdueEvents.n > 0 ? "alerta" : "agenda"}
          tone={overdueEvents.n > 0 ? "danger" : "default"}
          hint={overdueEvents.n > 0 ? `${overdueEvents.n} ${overdueEvents.n === 1 ? "vencido" : "vencidos"} sin completar` : "Todo al día"}
        />
        <Stat label="Horas sin facturar" value={formatMoney(unbilled.cents)} href="/horas?todos=1" icon="horas" hint={formatDuration(unbilled.minutes)} />
        <Stat
          label="Pendiente de cobro"
          value={formatMoney(outstanding)}
          href="/facturas?estado=emitida"
          icon="euro"
          tone={overdueInvoices.length ? "warn" : "default"}
          hint={overdueInvoices.length ? `${overdueInvoices.length} ${overdueInvoices.length === 1 ? "vencida" : "vencidas"} (${formatMoney(overdueAmount)})` : "Sin facturas vencidas"}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="card card-pad">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink-900">Expedientes activos por área</h2>
          <Donut data={areaData} centerLabel="activos" emptyText="Aún no hay expedientes activos" />
        </section>
        <section className="card card-pad">
          <h2 className="mb-4 font-serif text-lg font-semibold text-ink-900">Estado de los expedientes</h2>
          <BarList data={statusData} emptyText="Aún no hay expedientes" />
        </section>
        <section className="card card-pad">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold text-ink-900">Cobros por mes</h2>
            <span className="text-sm tabular-nums text-ink-500">{formatMoney(paidTotal)} en 6 meses</span>
          </div>
          <Columns data={paidData} format={(c) => formatMoney(c).replace(/,\d\d\s/, " ")} emptyText="Sin cobros registrados en estos meses" />
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-ink-900">Calendario · {monthLabel(month)}</h2>
            <div className="no-print flex items-center gap-1.5">
              <Link className="btn-secondary btn-sm" href={`/${qs({ mes: shiftMonth(month, -1) })}`} aria-label="Mes anterior">
                ‹
              </Link>
              <Link className="btn-secondary btn-sm" href="/">
                Hoy
              </Link>
              <Link className="btn-secondary btn-sm" href={`/${qs({ mes: shiftMonth(month, 1) })}`} aria-label="Mes siguiente">
                ›
              </Link>
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 sm:px-5">
            <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-500" aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((day) => {
                const inMonth = day.startsWith(month);
                const list = eventsByDay.get(day) ?? [];
                const isToday = day === today;
                const label = `${Number(day.slice(8))}${list.length ? `: ${list.length} ${list.length === 1 ? "evento" : "eventos"}` : ""}`;
                return (
                  <Link
                    key={day}
                    href={`/agenda${qs({ mes: day.slice(0, 7) })}`}
                    aria-label={label}
                    title={list.map((e) => `${eventKindLabels[e.kind]}: ${e.title}`).join("\n") || undefined}
                    className={`flex min-h-12 flex-col items-center rounded-lg px-1 py-1.5 text-sm transition-colors hover:bg-brand-50 sm:min-h-16 ${
                      inMonth ? "text-ink-800" : "text-ink-300"
                    } ${list.length && inMonth ? "bg-ink-50" : ""}`}
                  >
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full tabular-nums ${isToday ? "bg-brand-600 font-semibold text-white" : ""}`}>
                      {Number(day.slice(8))}
                    </span>
                    {list.length > 0 && (
                      <span className="mt-1 flex flex-wrap justify-center gap-0.5" aria-hidden="true">
                        {list.slice(0, 4).map((e) => (
                          <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.completed ? "bg-ink-300" : kindDot[e.kind]}`} />
                        ))}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs text-ink-600">
              {(Object.keys(eventKindLabels) as (keyof typeof eventKindLabels)[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${kindDot[k]}`} aria-hidden="true" />
                  {eventKindLabels[k]}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-ink-900">Mi agenda, próximos 14 días</h2>
            <Link href="/agenda?mios=1" className="link text-sm">
              Ver agenda
            </Link>
          </div>
          <EventsList rows={upcoming} returnTo="/" empty="No tienes eventos ni plazos próximos" />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-ink-900">Mis expedientes</h2>
            <Link href="/expedientes?mios=1" className="link text-sm">
              Ver todos
            </Link>
          </div>
          {recentMatters.length === 0 ? (
            <EmptyState title="No tienes expedientes asignados">
              <Link href="/expedientes/nuevo" className="link">
                Abrir un expediente
              </Link>
            </EmptyState>
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
                      {m.client}, {areaLabels[m.area].toLowerCase()}, desde el {formatDate(m.openedAt)}
                    </p>
                  </div>
                  <Badge kind="matter" value={m.status} label={matterStatusLabels[m.status]} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold text-ink-900">Facturas vencidas sin cobrar</h2>
            <Link href="/facturas?estado=vencidas" className="link text-sm">
              Ver todas
            </Link>
          </div>
          {overdueInvoices.length === 0 ? (
            <EmptyState title="No hay facturas vencidas">Las facturas emitidas que pasen su vencimiento sin cobrarse aparecerán aquí.</EmptyState>
          ) : (
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
          )}
        </section>
      </div>
    </>
  );
}
