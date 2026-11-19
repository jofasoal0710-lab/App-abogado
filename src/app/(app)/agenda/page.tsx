import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events, matters, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { buildMonthGrid, currentMonth, dayKey, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/dates";
import { qs } from "@/lib/search";
import { EventsList } from "./events-list";

export const metadata: Metadata = { title: "Control de plazos" };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const kindDot: Record<string, string> = {
  audiencia: "bg-red-500",
  plazo: "bg-amber-500",
  reunion: "bg-brand-500",
  tarea: "bg-ink-400",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; mios?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : currentMonth();
  const mine = sp.mios === "1";
  const { start, end } = monthRange(month);
  const mineFilter = mine ? eq(events.assignedId, user.id) : undefined;
  const accessFilter = matterAccessSql(user, events.matterId, { orNone: true });
  const base = db
    .select(eventSelect)
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId));

  const [monthEvents, overdue] = await Promise.all([
    base.where(and(gte(events.startsAt, start), lt(events.startsAt, end), mineFilter, accessFilter)).orderBy(asc(events.startsAt)),
    db
      .select(eventSelect)
      .from(events)
      .leftJoin(matters, eq(matters.id, events.matterId))
      .leftJoin(users, eq(users.id, events.assignedId))
      .where(
        and(
          eq(events.completed, false),
          lt(events.startsAt, new Date(new Date().setHours(0, 0, 0, 0))),
          inArray(events.kind, ["plazo", "tarea"]),
          mineFilter,
          accessFilter,
        ),
      )
      .orderBy(asc(events.startsAt))
      .limit(20),
  ]);

  const byDay = new Map<string, typeof monthEvents>();
  for (const e of monthEvents) {
    const key = dayKey(e.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const weeks = buildMonthGrid(month);
  const today = todayISO();
  const returnTo = `/agenda${qs({ mes: month, mios: mine ? "1" : "" })}`;

  return (
    <>
      <PageHeader
        title="Control de plazos"
        subtitle={monthLabel(month)}
        actions={
          <Link href="/agenda/nuevo" className="btn-primary">
            Nuevo evento
          </Link>
        }
      />

      {overdue.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-lg border border-red-200 bg-red-50/50">
          <h2 className="border-b border-red-200 px-5 py-2.5 text-sm font-semibold text-red-800">
            Plazos y tareas vencidos sin completar ({overdue.length})
          </h2>
          <EventsList rows={overdue} returnTo={returnTo} />
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link className="btn-secondary btn-sm" href={`/agenda${qs({ mes: shiftMonth(month, -1), mios: mine ? "1" : "" })}`}>
            ← Anterior
          </Link>
          <Link className="btn-secondary btn-sm" href={`/agenda${qs({ mios: mine ? "1" : "" })}`}>
            Hoy
          </Link>
          <Link className="btn-secondary btn-sm" href={`/agenda${qs({ mes: shiftMonth(month, 1), mios: mine ? "1" : "" })}`}>
            Siguiente →
          </Link>
        </div>
        <Link className="link text-sm" href={`/agenda${qs({ mes: month, mios: mine ? "" : "1" })}`}>
          {mine ? "Ver agenda de todo el equipo" : "Ver solo mi agenda"}
        </Link>
      </div>

      <div className="card mb-6 hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-ink-100 last:border-b-0">
            {week.map((day) => {
              const inMonth = day.startsWith(month);
              const dayEvents = byDay.get(day) ?? [];
              return (
                <div key={day} className={`min-h-24 border-r border-ink-100 p-1.5 last:border-r-0 ${inMonth ? "" : "bg-ink-50/70"}`}>
                  <p
                    className={`mb-1 text-right text-xs ${
                      day === today ? "ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 font-semibold text-white" : inMonth ? "text-ink-600" : "text-ink-400"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </p>
                  <ul className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/agenda/${e.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}
                          className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs hover:bg-ink-100 ${e.completed ? "text-ink-500 line-through" : "text-ink-800"}`}
                          title={e.title}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kindDot[e.kind]}`} />
                          <span className="truncate">{e.title}</span>
                        </Link>
                      </li>
                    ))}
                    {dayEvents.length > 3 && <li className="px-1 text-xs text-ink-500">+{dayEvents.length - 3} más</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Eventos de {monthLabel(month)}</h2>
        <EventsList rows={monthEvents} returnTo={returnTo} empty="No hay eventos este mes" />
      </section>
    </>
  );
}
