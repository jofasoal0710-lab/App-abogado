import Link from "next/link";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { BarList, Columns, Donut } from "@/components/charts";
import { Icon, type IconName } from "@/components/icons";
import { Badge, EmptyState, Stat } from "@/components/ui";
import { db } from "@/db";
import { clients, documents, events, invoices, matterFunds, matterNotes, matters, payments, runningTimers, timeEntries, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { invoiceAccessSql, matterAccessSql } from "@/lib/access";
import type { CurrentUser } from "@/lib/auth";
import { buildMonthGrid, currentMonth, dayKey, daysUntil, formatDate, formatDateTime, formatTime, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/dates";
import { countdown, URGENCY, urgencyOf } from "@/lib/deadlines";
import { loadAdjustments } from "@/lib/invoice-queries";
import { summarizeInvoice } from "@/lib/invoices";
import { areaLabels, eventKindLabels, matterStatusLabels } from "@/lib/labels";
import { appLocale } from "@/lib/locale";
import { formatDuration, formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { qs } from "@/lib/search";
import { TASK_PRIORITIES, dueState, sortTasks } from "@/lib/tasks";
import type { WidgetId } from "@/lib/dashboard-widgets";

/* Cada widget es un componente de servidor independiente: carga solo sus datos (si no está en el panel,
   no se consulta nada) y siempre respeta las reglas de acceso de la persona. */

const ACTIVE = ["abierto", "en_curso", "en_espera"] as const;
const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));
const mine = (user: CurrentUser, extra?: ReturnType<typeof and>) =>
  and(eq(events.assignedId, user.id), eq(events.completed, false), matterAccessSql(user, events.matterId, { orNone: true }), extra);

function Card({ title, icon, href, linkText, children, pad = false }: { title: string; icon?: IconName; href?: string; linkText?: string; children: React.ReactNode; pad?: boolean }) {
  return (
    <section className="card flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink-900">
          {icon && <Icon name={icon} className="h-5 w-5 text-brand-600" />}
          {title}
        </h2>
        {href && (
          <Link href={href} className="link shrink-0 text-sm">
            {linkText ?? "Ver todo"}
          </Link>
        )}
      </div>
      <div className={`flex-1 ${pad ? "p-5" : ""}`}>{children}</div>
    </section>
  );
}

/* ---------------- Primeros pasos ---------------- */

async function PrimerosPasos({ user }: { user: CurrentUser }) {
  const [[c], [m], [h], [t], [d]] = await Promise.all([
    db.select({ n: count() }).from(clients),
    db.select({ n: count() }).from(matters).where(matterAccessSql(user, matters.id)),
    db.select({ n: count() }).from(timeEntries).where(eq(timeEntries.userId, user.id)),
    db.select({ n: count() }).from(events).where(and(eq(events.assignedId, user.id))),
    db.select({ n: count() }).from(documents).where(eq(documents.uploadedById, user.id)),
  ]);
  const steps = [
    { done: c.n > 0, title: "Da de alta un cliente", text: "Sus datos (cédula, dirección…) rellenan solos escritos y plantillas.", href: "/clientes/nuevo" },
    { done: m.n > 0, title: "Abre un expediente", text: "Todo cuelga de él: notas, documentos, plazos, horas y facturas.", href: "/expedientes/nuevo" },
    { done: t.n > 0, title: "Apunta un plazo o una tarea", text: "La app te avisa antes de que venza (y lo ves en el tablero de tareas).", href: "/agenda/nuevo" },
    { done: h.n > 0, title: "Registra tus horas", text: "A mano o con el cronómetro del expediente; luego se facturan solas.", href: "/horas" },
    { done: d.n > 0, title: "Sube o genera un documento", text: "Súbelo al expediente o genéralo desde Formularios o tus plantillas Word.", href: "/formularios" },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <Card title="Primeros pasos" icon="conocimiento">
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-600">
            {done === steps.length ? "¡Listo! Ya conoces lo esencial. Puedes quitar este widget." : `Llevas ${done} de ${steps.length}`}
          </span>
          <span className="text-xs text-ink-500">Atajo: Ctrl+K busca y abre cualquier cosa</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className={`flex h-full gap-3 rounded-xl border p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 ${s.done ? "border-emerald-200 bg-emerald-50/40" : "border-ink-200"}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${s.done ? "bg-emerald-500 text-white" : "bg-ink-100 text-ink-600"}`} aria-hidden>
                {s.done ? "✓" : i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-ink-900">
                  {s.title}
                  {s.done && <span className="sr-only"> (hecho)</span>}
                </span>
                <span className="block text-xs text-ink-500">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ---------------- Accesos rápidos ---------------- */

function Accesos({ user }: { user: CurrentUser }) {
  const items: { href: string; label: string; icon: IconName; show?: boolean }[] = [
    { href: "/expedientes/nuevo", label: "Nuevo expediente", icon: "expedientes" },
    { href: "/clientes/nuevo", label: "Nuevo cliente", icon: "clientes" },
    { href: "/agenda/nuevo", label: "Plazo o evento", icon: "agenda" },
    { href: "/tareas", label: "Tablero de tareas", icon: "tareas" },
    { href: "/horas", label: "Registrar horas", icon: "horas" },
    { href: "/formularios", label: "Redactar un escrito", icon: "formularios" },
    { href: "/facturas/nueva", label: "Nueva factura", icon: "facturas", show: can(user, "facturacion.emitir") },
    { href: "/herramientas", label: "Calculadoras", icon: "calculadora" },
  ];
  return (
    <Card title="Accesos rápidos" icon="panel">
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {items
          .filter((i) => i.show !== false)
          .map((i) => (
            <Link key={i.href} href={i.href} className="flex flex-col items-center gap-2 rounded-xl border border-ink-200 px-2 py-4 text-center text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={i.icon} className="h-5 w-5" />
              </span>
              {i.label}
            </Link>
          ))}
      </div>
    </Card>
  );
}

/* ---------------- Cifras ---------------- */

async function Cifras({ user }: { user: CurrentUser }) {
  const seesBilling = can(user, "facturacion.ver");
  const sod = startOfToday();
  const in7 = new Date(sod.getTime() + 7 * 86_400_000);
  const today = todayISO();
  const [[active], [unbilled], [overdue], [week], emitted] = await Promise.all([
    db.select({ n: count() }).from(matters).where(and(inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id))),
    db
      .select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int`, cents: sql<number>`coalesce(sum(round(${timeEntries.minutes} * ${timeEntries.rateCents} / 60.0)), 0)::float8` })
      .from(timeEntries)
      .innerJoin(matters, eq(matters.id, timeEntries.matterId))
      .where(and(eq(timeEntries.billable, true), isNull(timeEntries.invoiceId), eq(matters.billingType, "por_horas"), matterAccessSql(user, matters.id))),
    db.select({ n: count() }).from(events).where(mine(user, and(lt(events.startsAt, sod), inArray(events.kind, ["plazo", "tarea"])))),
    db.select({ n: count() }).from(events).where(mine(user, and(gte(events.startsAt, sod), lt(events.startsAt, in7)))),
    seesBilling ? db.query.invoices.findMany({ where: and(eq(invoices.status, "emitida"), invoiceAccessSql(user)), with: { items: true, payments: true } }) : Promise.resolve([]),
  ]);
  const adj = await loadAdjustments(db, emitted.filter((i) => i.kind === "factura").map((i) => i.id));
  const sums = emitted.map((inv) => summarizeInvoice(inv, today, adj.get(inv.id)));
  const outstanding = sums.reduce((s, x) => s + x.outstandingCents, 0);
  const late = sums.filter((x) => x.overdue);
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Expedientes activos" value={active.n} href="/expedientes" icon="expedientes" />
      <Stat
        label="Mis plazos esta semana"
        value={week.n}
        href="/agenda?mios=1"
        icon={overdue.n > 0 ? "alerta" : "agenda"}
        tone={overdue.n > 0 ? "danger" : "default"}
        hint={overdue.n > 0 ? `${overdue.n} ${overdue.n === 1 ? "vencido" : "vencidos"} sin completar` : "Todo al día"}
      />
      <Stat label="Horas sin facturar" value={formatMoney(unbilled.cents)} href="/horas?todos=1" icon="horas" hint={formatDuration(unbilled.minutes)} />
      {seesBilling ? (
        <Stat
          label="Pendiente de cobro"
          value={formatMoney(outstanding)}
          href="/facturas?estado=emitida"
          icon="cobro"
          tone={late.length ? "warn" : "default"}
          hint={late.length ? `${late.length} ${late.length === 1 ? "vencida" : "vencidas"} (${formatMoney(late.reduce((s, x) => s + x.outstandingCents, 0))})` : "Sin facturas vencidas"}
        />
      ) : (
        <Stat label="Tareas abiertas" value={(await db.select({ n: count() }).from(events).where(and(eq(events.kind, "tarea"), eq(events.assignedId, user.id), ne(events.status, "hecha"))))[0].n} href="/tareas" icon="tareas" />
      )}
    </div>
  );
}

/* ---------------- Próximos 14 días ---------------- */

async function Proximos({ user }: { user: CurrentUser }) {
  const sod = startOfToday();
  const rows = await db
    .select(eventSelect)
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .where(mine(user, and(gte(events.startsAt, sod), lt(events.startsAt, new Date(sod.getTime() + 14 * 86_400_000)))))
    .orderBy(asc(events.startsAt))
    .limit(8);
  const today = todayISO();
  return (
    <Card title="Mis próximos 14 días" icon="agenda" href="/agenda?mios=1" linkText="Ver agenda">
      {rows.length === 0 ? (
        <EmptyState title="Nada en tu agenda">
          <Link href="/agenda/nuevo" className="link">
            Añadir un evento o plazo
          </Link>
        </EmptyState>
      ) : (
        <ol className="space-y-1 p-3">
          {rows.map((e) => {
            const d = new Date(e.startsAt);
            const isToday = dayKey(e.startsAt) === today;
            return (
              <li key={e.id}>
                <Link href={e.matterId ? `/expedientes/${e.matterId}?tab=agenda` : "/agenda"} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-50">
                  <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${isToday ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-800"}`}>
                    <span className="font-serif text-lg font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="text-[10px] font-medium">{d.toLocaleDateString(appLocale(), { month: "short" }).replace(".", "")}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${URGENCY[urgencyOf(daysUntil(e.startsAt), false)].dot}`} aria-hidden="true" />
                      <span className="truncate">{e.title}</span>
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {eventKindLabels[e.kind]} · {isToday ? "hoy" : d.toLocaleDateString(appLocale(), { weekday: "long" })} {formatTime(e.startsAt)} · {countdown(dayKey(e.startsAt), today, daysUntil(e.startsAt), false)}
                      {e.matterNumber ? ` · ${e.matterNumber}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* ---------------- Mis tareas ---------------- */

async function MisTareas({ user }: { user: CurrentUser }) {
  const rows = await db
    .select({ id: events.id, title: events.title, status: events.status, priority: events.priority, startsAt: events.startsAt, matterNumber: matters.number })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .where(and(eq(events.kind, "tarea"), eq(events.assignedId, user.id), ne(events.status, "hecha"), matterAccessSql(user, events.matterId, { orNone: true })))
    .limit(200);
  const today = todayISO();
  const list = sortTasks(rows).sort((a, b) => Number(dueState(todayISO(b.startsAt), today, false) === "vencida") - Number(dueState(todayISO(a.startsAt), today, false) === "vencida"));
  const overdue = list.filter((t) => todayISO(t.startsAt) < today).length;
  const doing = list.filter((t) => t.status === "en_curso").length;
  return (
    <Card title="Mis tareas" icon="tareas" href="/tareas" linkText="Abrir tablero">
      <div className="flex gap-2 px-5 pt-4 text-xs">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-700">{list.length} abiertas</span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{doing} en curso</span>
        {overdue > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{overdue} vencidas</span>}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Sin tareas pendientes">
          <Link href="/tareas" className="link">
            Crear una tarea
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100 px-2 py-2">
          {list.slice(0, 6).map((t) => {
            const due = todayISO(t.startsAt);
            const st = dueState(due, today, false);
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <Link href={`/agenda/${t.id}/editar?returnTo=${encodeURIComponent("/")}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                    {t.title}
                  </Link>
                  <span className="text-xs text-ink-500">
                    {TASK_PRIORITIES[t.priority]}
                    {t.status === "en_curso" ? " · en curso" : ""}
                    {t.matterNumber ? ` · ${t.matterNumber}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 text-xs ${st === "vencida" ? "font-semibold text-red-700" : st === "hoy" ? "font-semibold text-amber-700" : "text-ink-500"}`}>
                  {st === "vencida" ? "vencida" : st === "hoy" ? "hoy" : formatDate(due)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Audiencias de la semana ---------------- */

async function Audiencias({ user }: { user: CurrentUser }) {
  const sod = startOfToday();
  const rows = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, hearingType: events.hearingType, location: events.location, meetingUrl: events.meetingUrl, matterId: events.matterId, matterNumber: matters.number, assigned: users.name })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .where(and(eq(events.kind, "audiencia"), eq(events.completed, false), gte(events.startsAt, sod), lt(events.startsAt, new Date(sod.getTime() + 7 * 86_400_000)), matterAccessSql(user, events.matterId, { orNone: true })))
    .orderBy(asc(events.startsAt))
    .limit(6);
  return (
    <Card title="Audiencias de la semana" icon="balanza" href="/agenda/audiencias">
      {rows.length === 0 ? (
        <EmptyState title="Sin audiencias en 7 días" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((h) => (
            <li key={h.id} className="px-5 py-3 text-sm">
              <p className="font-medium text-ink-900">{h.hearingType ?? h.title}</p>
              <p className="text-xs text-ink-500">
                {new Date(h.startsAt).toLocaleDateString(appLocale(), { weekday: "short", day: "numeric", month: "short" })} {formatTime(h.startsAt)}
                {h.matterNumber ? ` · ${h.matterNumber}` : ""}
                {h.assigned ? ` · ${h.assigned}` : ""}
              </p>
              {h.meetingUrl ? (
                <a className="link text-xs" href={h.meetingUrl} target="_blank" rel="noopener noreferrer">
                  Unirse a la sala virtual
                </a>
              ) : h.location ? (
                <p className="text-xs text-ink-500">{h.location}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Mis horas ---------------- */

/** «12 h 45» (compacto para las cajitas del widget). */
const hm = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")}` : ""}`);

async function MisHoras({ user }: { user: CurrentUser }) {
  const today = todayISO();
  const d = new Date();
  const monday = todayISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
  const first = `${today.slice(0, 7)}-01`;
  const [[r], timer] = await Promise.all([
    db
      .select({
        today: sql<number>`coalesce(sum(${timeEntries.minutes}) filter (where ${timeEntries.workedOn} = ${today}), 0)::int`,
        week: sql<number>`coalesce(sum(${timeEntries.minutes}) filter (where ${timeEntries.workedOn} >= ${monday}), 0)::int`,
        month: sql<number>`coalesce(sum(${timeEntries.minutes}) filter (where ${timeEntries.workedOn} >= ${first}), 0)::int`,
        billable: sql<number>`coalesce(sum(${timeEntries.minutes}) filter (where ${timeEntries.workedOn} >= ${first} and ${timeEntries.billable}), 0)::int`,
      })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, user.id), gte(timeEntries.workedOn, monday < first ? monday : first))),
    db.select({ matter: matters.number }).from(runningTimers).innerJoin(matters, eq(matters.id, runningTimers.matterId)).where(eq(runningTimers.userId, user.id)),
  ]);
  const pct = r.month ? Math.round((r.billable / r.month) * 100) : 0;
  return (
    <Card title="Mis horas" icon="horas" href="/horas" linkText="Registrar">
      <dl className="grid grid-cols-3 gap-2 p-5 text-center">
        {[
          ["Hoy", r.today],
          ["Semana", r.week],
          ["Mes", r.month],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-ink-50 px-2 py-3">
            <dt className="text-xs text-ink-500">{l}</dt>
            <dd className="whitespace-nowrap font-serif text-xl font-semibold tabular-nums text-ink-900">{hm(v as number)}</dd>
          </div>
        ))}
      </dl>
      <div className="px-5 pb-4 text-xs text-ink-600">
        <div className="mb-1 flex justify-between">
          <span>Facturables este mes</span>
          <span className="tabular-nums">{pct} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3">{timer.length ? `⏱ Cronómetro en marcha en ${timer[0].matter}.` : "Consejo: «Iniciar cronómetro» en un expediente mide el tiempo por ti."}</p>
      </div>
    </Card>
  );
}

/* ---------------- Calendario ---------------- */

async function Calendario({ user, month }: { user: CurrentUser; month: string }) {
  const { start, end } = monthRange(month);
  const rows = await db
    .select({ id: events.id, kind: events.kind, title: events.title, startsAt: events.startsAt, completed: events.completed })
    .from(events)
    .where(and(gte(events.startsAt, start), lt(events.startsAt, end), matterAccessSql(user, events.matterId, { orNone: true })))
    .orderBy(asc(events.startsAt));
  const byDay = new Map<string, typeof rows>();
  for (const e of rows) byDay.set(dayKey(e.startsAt), [...(byDay.get(dayKey(e.startsAt)) ?? []), e]);
  const today = todayISO();
  const kindDot: Record<string, string> = { audiencia: "bg-red-500", plazo: "bg-amber-500", reunion: "bg-brand-500", tarea: "bg-ink-400" };
  return (
    <section className="card h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink-900">
          <Icon name="agenda" className="h-5 w-5 text-brand-600" />
          {monthLabel(month)}
        </h2>
        <div className="no-print flex items-center gap-1.5">
          <Link className="btn-secondary btn-sm min-w-10" href={`/${qs({ mes: shiftMonth(month, -1) })}`} aria-label="Mes anterior">
            ‹
          </Link>
          <Link className="btn-secondary btn-sm" href="/">
            Hoy
          </Link>
          <Link className="btn-secondary btn-sm min-w-10" href={`/${qs({ mes: shiftMonth(month, 1) })}`} aria-label="Mes siguiente">
            ›
          </Link>
        </div>
      </div>
      <div className="px-3 pb-3 pt-2 sm:px-5">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-500" aria-hidden="true">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {buildMonthGrid(month)
            .flat()
            .map((day) => {
              const inMonth = day.startsWith(month);
              const list = byDay.get(day) ?? [];
              return (
                <Link
                  key={day}
                  href={`/agenda${qs({ mes: day.slice(0, 7) })}`}
                  aria-label={`${Number(day.slice(8))}${list.length ? `: ${list.length} ${list.length === 1 ? "evento" : "eventos"}` : ""}`}
                  title={list.map((e) => `${eventKindLabels[e.kind]}: ${e.title}`).join("\n") || undefined}
                  className={`flex min-h-11 flex-col items-center rounded-lg px-1 py-1 text-sm transition-colors hover:bg-brand-50 ${inMonth ? "text-ink-800" : "text-ink-400"} ${list.length && inMonth ? "bg-ink-50" : ""}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full tabular-nums ${day === today ? "bg-brand-600 font-semibold text-white" : ""}`}>{Number(day.slice(8))}</span>
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
  );
}

/* ---------------- Mis expedientes ---------------- */

async function MisExpedientes({ user }: { user: CurrentUser }) {
  const rows = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, area: matters.area, status: matters.status, client: clients.name, openedAt: matters.openedAt })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(and(eq(matters.responsibleId, user.id), inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt), desc(matters.id))
    .limit(6);
  return (
    <Card title="Mis expedientes" icon="expedientes" href="/expedientes?mios=1">
      {rows.length === 0 ? (
        <EmptyState title="No tienes expedientes asignados">
          <Link href="/expedientes/nuevo" className="link">
            Abrir un expediente
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((m) => (
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
    </Card>
  );
}

/* ---------------- Actividad reciente ---------------- */

type Activity = { key: string; at: Date; text: string; who: string; href: string; icon: IconName };

async function Actividad({ user }: { user: CurrentUser }) {
  const LIMIT = 6;
  const seesBilling = can(user, "facturacion.ver");
  const [docs, notes, hours, pays] = await Promise.all([
    db.select({ id: documents.id, at: documents.createdAt, name: documents.name, who: users.name, matterId: matters.id, number: matters.number }).from(documents).innerJoin(matters, eq(matters.id, documents.matterId)).leftJoin(users, eq(users.id, documents.uploadedById)).where(matterAccessSql(user, matters.id)).orderBy(desc(documents.createdAt)).limit(LIMIT),
    db.select({ id: matterNotes.id, at: matterNotes.createdAt, body: matterNotes.body, who: users.name, matterId: matters.id, number: matters.number }).from(matterNotes).innerJoin(matters, eq(matters.id, matterNotes.matterId)).leftJoin(users, eq(users.id, matterNotes.authorId)).where(matterAccessSql(user, matters.id)).orderBy(desc(matterNotes.createdAt)).limit(LIMIT),
    db.select({ id: timeEntries.id, at: timeEntries.createdAt, minutes: timeEntries.minutes, desc: timeEntries.description, who: users.name, matterId: matters.id, number: matters.number }).from(timeEntries).innerJoin(matters, eq(matters.id, timeEntries.matterId)).innerJoin(users, eq(users.id, timeEntries.userId)).where(matterAccessSql(user, matters.id)).orderBy(desc(timeEntries.createdAt)).limit(LIMIT),
    seesBilling
      ? db.select({ id: payments.id, at: payments.createdAt, cents: payments.amountCents, invoiceId: invoices.id, number: invoices.number, client: clients.name }).from(payments).innerJoin(invoices, eq(invoices.id, payments.invoiceId)).innerJoin(clients, eq(clients.id, invoices.clientId)).where(invoiceAccessSql(user)).orderBy(desc(payments.createdAt)).limit(LIMIT)
      : Promise.resolve([]),
  ]);
  const all: Activity[] = [
    ...docs.map((d) => ({ key: `d${d.id}`, at: d.at, text: `Documento «${d.name}» en ${d.number}`, who: d.who ?? "—", href: `/expedientes/${d.matterId}?tab=documentos`, icon: "documentos" as const })),
    ...notes.map((n) => ({ key: `n${n.id}`, at: n.at, text: `Nota en ${n.number}: ${n.body.slice(0, 90)}`, who: n.who ?? "—", href: `/expedientes/${n.matterId}?tab=notas`, icon: "nota" as const })),
    ...hours.map((h) => ({ key: `h${h.id}`, at: h.at, text: `${formatDuration(h.minutes)} en ${h.number}: ${h.desc.slice(0, 70)}`, who: h.who, href: `/expedientes/${h.matterId}?tab=horas`, icon: "horas" as const })),
    ...pays.map((p) => ({ key: `p${p.id}`, at: p.at, text: `Cobro de ${formatMoney(p.cents)} · ${p.number ?? "factura"} (${p.client})`, who: "Facturación", href: `/facturas/${p.invoiceId}`, icon: "cobro" as const })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 7);
  return (
    <Card title="Actividad reciente" icon="actividad">
      {all.length === 0 ? (
        <EmptyState title="Todavía no hay actividad" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {all.map((a) => (
            <li key={a.key} className="flex gap-3 px-5 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                <Icon name={a.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-sm">
                <Link href={a.href} className="line-clamp-2 text-ink-800 hover:text-brand-700 hover:underline">
                  {a.text}
                </Link>
                <p className="text-xs text-ink-500">
                  {a.who} · {formatDateTime(a.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Gráficos ---------------- */

async function Areas({ user }: { user: CurrentUser }) {
  const rows = await db.select({ area: matters.area, n: count() }).from(matters).where(and(inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id))).groupBy(matters.area);
  const m = new Map(rows.map((r) => [r.area, r.n]));
  const data = (Object.keys(areaLabels) as (keyof typeof areaLabels)[]).map((k) => ({ key: k, label: areaLabels[k], value: m.get(k) ?? 0 })).sort((a, b) => b.value - a.value);
  return (
    <Card title="Expedientes por área" icon="expedientes" pad>
      <Donut data={data} centerLabel="activos" emptyText="Aún no hay expedientes activos" />
    </Card>
  );
}

async function Estados({ user }: { user: CurrentUser }) {
  const rows = await db.select({ status: matters.status, n: count() }).from(matters).where(matterAccessSql(user, matters.id)).groupBy(matters.status);
  const m = new Map(rows.map((r) => [r.status, r.n]));
  const colors: Record<string, string> = { abierto: "#4f86e0", en_curso: "#1f57b8", en_espera: "#b7791f", cerrado: "#64748b", archivado: "#94a3b8" };
  const data = (Object.keys(matterStatusLabels) as (keyof typeof matterStatusLabels)[]).map((k) => ({ key: k, label: matterStatusLabels[k], value: m.get(k) ?? 0, color: colors[k], href: `/expedientes?estado=${k}` }));
  return (
    <Card title="Estado de los expedientes" icon="expedientes" pad>
      <BarList data={data} emptyText="Aún no hay expedientes" />
    </Card>
  );
}

async function Cobros({ user }: { user: CurrentUser }) {
  const thisMonth = currentMonth();
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
  const rows = await db
    .select({ month: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`, cents: sql<number>`sum(${payments.amountCents})::float8` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(gte(payments.paidAt, `${months[0]}-01`), invoiceAccessSql(user)))
    .groupBy(sql`1`);
  const paid = new Map(rows.map((r) => [r.month, r.cents]));
  const data = months.map((m) => ({ key: m, label: monthLabel(m).slice(0, 3), value: paid.get(m) ?? 0, current: m === thisMonth }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card title="Cobros por mes" icon="cobro" pad>
      <p className="-mt-1 mb-3 text-sm tabular-nums text-ink-500">{formatMoney(total)} en 6 meses</p>
      <Columns data={data} format={(c) => formatMoney(c).replace(/,\d\d\s/, " ")} emptyText="Sin cobros registrados en estos meses" />
    </Card>
  );
}

async function FacturasVencidas({ user }: { user: CurrentUser }) {
  const today = todayISO();
  const emitted = await db.query.invoices.findMany({ where: and(eq(invoices.status, "emitida"), invoiceAccessSql(user)), with: { items: true, payments: true, client: true }, orderBy: asc(invoices.dueDate) });
  const adj = await loadAdjustments(db, emitted.filter((i) => i.kind === "factura").map((i) => i.id));
  const late = emitted.map((inv) => ({ inv, s: summarizeInvoice(inv, today, adj.get(inv.id)) })).filter((x) => x.s.overdue);
  return (
    <Card title="Facturas vencidas" icon="facturas" href="/facturas?estado=vencidas">
      {late.length === 0 ? (
        <EmptyState title="No hay facturas vencidas">Las facturas emitidas que pasen su vencimiento sin cobrarse aparecerán aquí.</EmptyState>
      ) : (
        <ul className="divide-y divide-ink-100">
          {late.slice(0, 5).map(({ inv, s }) => (
            <li key={inv.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <Link className="link" href={`/facturas/${inv.id}`}>
                  {inv.number}
                </Link>
                <p className="truncate text-ink-700">{inv.client.name}</p>
                <p className="text-xs text-red-700">Venció el {formatDate(inv.dueDate)}</p>
              </div>
              <span className="shrink-0 font-medium tabular-nums text-ink-900">{formatMoney(s.outstandingCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Provisiones({ user }: { user: CurrentUser }) {
  const bal = sql<number>`coalesce(sum(case when ${matterFunds.kind} = 'deposito' then ${matterFunds.amountCents} else -${matterFunds.amountCents} end), 0)::float8`;
  const rows = await db
    .select({ id: matters.id, number: matters.number, client: clients.name, min: matters.fundsMinCents, balance: bal })
    .from(matterFunds)
    .innerJoin(matters, eq(matters.id, matterFunds.matterId))
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(matterAccessSql(user, matters.id))
    .groupBy(matters.id, clients.name);
  const low = rows.map((r) => ({ ...r, balance: Number(r.balance) })).filter((r) => r.balance <= 0 || (r.min != null && r.balance < r.min)).sort((a, b) => a.balance - b.balance);
  return (
    <Card title="Provisiones bajas" icon="cobro" href="/reportes#provisiones" linkText="Ver todas">
      {low.length === 0 ? (
        <EmptyState title="Todas las provisiones están en orden" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {low.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <Link className="link" href={`/expedientes/${r.id}?tab=cobro#provision`}>
                  {r.number}
                </Link>
                <span className="block truncate text-xs text-ink-500">{r.client}</span>
              </span>
              <span className={`shrink-0 text-right text-xs ${r.balance <= 0 ? "font-semibold text-red-700" : "text-amber-700"}`}>
                {r.balance <= 0 ? "Agotada" : formatMoney(r.balance)}
                {r.min != null && r.balance > 0 && <span className="block text-ink-500">mín. {formatMoney(r.min)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Renderiza el widget pedido (los que requieren permisos ya se filtraron al calcular la disposición). */
export function renderWidget(id: WidgetId, user: CurrentUser, month: string): React.ReactNode {
  switch (id) {
    case "primeros_pasos":
      return <PrimerosPasos user={user} />;
    case "accesos":
      return <Accesos user={user} />;
    case "cifras":
      return <Cifras user={user} />;
    case "proximos":
      return <Proximos user={user} />;
    case "mis_tareas":
      return <MisTareas user={user} />;
    case "audiencias":
      return <Audiencias user={user} />;
    case "mis_horas":
      return <MisHoras user={user} />;
    case "calendario":
      return <Calendario user={user} month={month} />;
    case "mis_expedientes":
      return <MisExpedientes user={user} />;
    case "actividad":
      return <Actividad user={user} />;
    case "areas":
      return <Areas user={user} />;
    case "estados":
      return <Estados user={user} />;
    case "cobros":
      return <Cobros user={user} />;
    case "facturas_vencidas":
      return <FacturasVencidas user={user} />;
    case "provisiones":
      return <Provisiones user={user} />;
  }
}
