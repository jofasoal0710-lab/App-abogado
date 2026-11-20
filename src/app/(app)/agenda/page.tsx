import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events, matters, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { buildMonthGrid, currentMonth, dayKey, daysUntil, formatTime, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/dates";
import { holidayName } from "@/lib/cr-holidays";
import { URGENCY, urgencyOf } from "@/lib/deadlines";
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
  searchParams: Promise<{ mes?: string; mios?: string; vista?: string; semana?: string }>;
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

  // Vista semanal: del lunes de la semana pedida (o la actual) al domingo.
  const weekView = sp.vista === "semana";
  const today0 = todayISO();
  const mondayOf = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayISO(d);
  };
  const weekStart = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(sp.semana ?? "") ? sp.semana! : today0);
  const addDaysIso = (iso: string, n: number) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + n);
    return todayISO(d);
  };
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const in8 = new Date(startOfToday.getTime() + 8 * 86_400_000);

  const [weekEvents, upcoming] = await Promise.all([
    weekView
      ? base
          .where(and(gte(events.startsAt, new Date(`${weekStart}T00:00:00`)), lt(events.startsAt, new Date(`${addDaysIso(weekStart, 7)}T00:00:00`)), mineFilter, accessFilter))
          .orderBy(asc(events.startsAt))
      : Promise.resolve([]),
    db
      .select({ startsAt: events.startsAt })
      .from(events)
      .leftJoin(matters, eq(matters.id, events.matterId))
      .where(and(eq(events.completed, false), gte(events.startsAt, startOfToday), lt(events.startsAt, in8), mineFilter, accessFilter)),
  ]);
  const counts = { hoy: 0, pronto: 0, semana: 0 };
  for (const e of upcoming) {
    const u = urgencyOf(daysUntil(e.startsAt), false);
    if (u === "hoy" || u === "pronto" || u === "semana") counts[u]++;
  }

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

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["vencido", overdue.length, "vencidos sin completar"],
            ["hoy", counts.hoy, "vencen hoy"],
            ["pronto", counts.pronto, "mañana o pasado"],
            ["semana", counts.semana, "resto de la semana"],
          ] as const
        ).map(([k, n, label]) => (
          <div key={k} className={`card flex items-center gap-3 px-4 py-3 ${n > 0 && (k === "vencido" || k === "hoy") ? "ring-1 ring-red-200" : ""}`}>
            <span className={`h-3 w-3 shrink-0 rounded-full ${URGENCY[k].dot}`} aria-hidden="true" />
            <span>
              <span className="block text-2xl font-semibold tabular-nums text-ink-900">{n}</span>
              <span className="text-xs text-ink-600">{label}</span>
            </span>
          </div>
        ))}
      </div>

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
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-md border border-ink-300 text-sm" role="group" aria-label="Vista">
            <Link className={`px-3 py-1.5 ${!weekView ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-ink-50"}`} href={`/agenda${qs({ mes: month, mios: mine ? "1" : "" })}`} aria-current={!weekView ? "page" : undefined}>
              Mes
            </Link>
            <Link className={`px-3 py-1.5 ${weekView ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-ink-50"}`} href={`/agenda${qs({ vista: "semana", mios: mine ? "1" : "" })}`} aria-current={weekView ? "page" : undefined}>
              Semana
            </Link>
          </div>
          <Link className="link text-sm" href={`/agenda${qs({ mes: month, vista: weekView ? "semana" : "", semana: weekView ? weekStart : "", mios: mine ? "" : "1" })}`}>
            {mine ? "Ver agenda de todo el equipo" : "Ver solo mi agenda"}
          </Link>
        </div>
      </div>

      {weekView && (
        <section className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Link className="btn-secondary btn-sm" href={`/agenda${qs({ vista: "semana", semana: addDaysIso(weekStart, -7), mios: mine ? "1" : "" })}`}>
              ← Semana anterior
            </Link>
            <Link className="btn-secondary btn-sm" href={`/agenda${qs({ vista: "semana", mios: mine ? "1" : "" })}`}>
              Esta semana
            </Link>
            <Link className="btn-secondary btn-sm" href={`/agenda${qs({ vista: "semana", semana: addDaysIso(weekStart, 7), mios: mine ? "1" : "" })}`}>
              Semana siguiente →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-7">
            {weekDays.map((d, i) => {
              const evs = weekEvents.filter((e) => dayKey(e.startsAt) === d);
              const hol = holidayName(d);
              return (
                <div key={d} className={`card min-h-40 p-2 ${d === today0 ? "ring-2 ring-brand-500" : ""} ${i >= 5 || hol ? "bg-ink-50" : ""}`}>
                  <p className="mb-2 flex items-baseline justify-between text-xs font-semibold text-ink-600">
                    <span>
                      {WEEKDAYS[i]} {Number(d.slice(8))}
                    </span>
                    {hol && <span className="truncate pl-1 font-normal text-ink-500" title={hol}>Feriado</span>}
                  </p>
                  <ul className="space-y-1.5">
                    {evs.map((e) => {
                      const u = URGENCY[urgencyOf(daysUntil(e.startsAt), e.completed)];
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/agenda/${e.id}/editar?returnTo=${encodeURIComponent(`/agenda${qs({ vista: "semana", semana: weekStart })}`)}`}
                            className={`relative block rounded-md border border-ink-200 bg-surface py-1.5 pl-3 pr-2 text-xs hover:border-brand-400 ${e.completed ? "text-ink-500 line-through" : "text-ink-800"}`}
                          >
                            <span className={`absolute inset-y-1 left-1 w-1 rounded-full ${u.bar}`} aria-hidden="true" />
                            <span className="block font-medium">{formatTime(e.startsAt)} · {e.title}</span>
                            {e.matterNumber && <span className="block text-ink-500">{e.matterNumber}</span>}
                          </Link>
                        </li>
                      );
                    })}
                    {evs.length === 0 && <li className="text-xs text-ink-400">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className={`card mb-6 hidden overflow-hidden ${weekView ? "" : "md:block"}`}>
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
