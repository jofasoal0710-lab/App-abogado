import type { Metadata } from "next";
import Link from "next/link";
import { aliasedTable, and, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events, matters, users } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { eventFormOptions } from "@/lib/agenda-data";
import { requireUser } from "@/lib/auth";
import { addDaysISO, formatDate, relativeDays, todayISO } from "@/lib/dates";
import { TASK_PRIORITIES, dueState, sortTasks } from "@/lib/tasks";
import { quickTaskAction } from "./actions";
import { TaskBoard, type BoardTask } from "./board";

export const metadata: Metadata = { title: "Tareas" };

const SCOPES = { mias: "Asignadas a mí", creadas: "Encargadas por mí", equipo: "Todo el equipo" } as const;
type Scope = keyof typeof SCOPES;

/** Tablero de tareas del despacho: pendiente → en curso → hecha, con filtros por persona y expediente. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ ambito?: string; expediente?: string; persona?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = sp.ambito && sp.ambito in SCOPES ? (sp.ambito as Scope) : sp.expediente ? "equipo" : "mias";
  const matterId = Number(sp.expediente) || null;
  const personId = Number(sp.persona) || null;
  const today = todayISO();
  const since = new Date(Date.now() - 14 * 86_400_000);
  const creator = aliasedTable(users, "creator");

  const rows = await db
    .select({ id: events.id, title: events.title, status: events.status, priority: events.priority, startsAt: events.startsAt, matterId: events.matterId, matterNumber: matters.number, assignee: users.name, completed: events.completed })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .leftJoin(creator, eq(creator.id, events.createdById))
    .where(
      and(
        eq(events.kind, "tarea"),
        matterAccessSql(user, events.matterId, { orNone: true }),
        // Lo hecho solo se ve dos semanas (el historial completo sigue en Control de plazos).
        or(ne(events.status, "hecha"), gte(events.completedAt, since), and(eq(events.status, "hecha"), isNull(events.completedAt), gte(events.startsAt, since))),
        scope === "mias" ? eq(events.assignedId, user.id) : scope === "creadas" ? and(eq(events.createdById, user.id), sql`${events.assignedId} is distinct from ${user.id}`) : undefined,
        matterId ? eq(events.matterId, matterId) : undefined,
        personId && scope === "equipo" ? eq(events.assignedId, personId) : undefined,
      ),
    )
    .limit(500);

  const tasks: BoardTask[] = sortTasks(rows).map((r) => {
    const due = todayISO(r.startsAt);
    const st = dueState(due, today, r.status === "hecha");
    const diff = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      dueLabel: r.status === "hecha" ? `Fecha ${formatDate(due)}` : st === "vencida" ? `Venció ${relativeDays(diff)}` : `Vence ${relativeDays(diff)}`,
      dueState: st,
      matterId: r.matterId,
      matterNumber: r.matterNumber,
      assignee: r.assignee,
      initials: (r.assignee ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(""),
      editHref: `/agenda/${r.id}/editar?returnTo=${encodeURIComponent("/tareas")}`,
    };
  });
  const open = tasks.filter((t) => t.status !== "hecha");
  const overdue = open.filter((t) => t.dueState === "vencida").length;
  const options = await eventFormOptions(user);
  const matterLabel = matterId ? options.matters.find((m) => m.id === matterId)?.label : null;
  const qs = (extra: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    const all = { ambito: scope, expediente: matterId, persona: personId, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) u.set(k, String(v));
    return `/tareas?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Tareas"
        subtitle={`${open.length} abiertas${overdue ? ` · ${overdue} vencidas` : ""}${matterLabel ? ` · ${matterLabel}` : ""}. Arrastra las tarjetas entre columnas o usa sus botones.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="grid w-full grid-cols-3 rounded-lg border border-ink-200 bg-white p-0.5 sm:inline-flex sm:w-auto" role="group" aria-label="Qué tareas ver">
          {(Object.keys(SCOPES) as Scope[]).map((k) => (
            <Link key={k} href={qs({ ambito: k, persona: k === "equipo" ? personId : null })} aria-current={scope === k ? "page" : undefined} className={`rounded-md px-2 py-1.5 text-center text-xs font-medium sm:px-3 sm:text-sm ${scope === k ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"}`}>
              {SCOPES[k]}
            </Link>
          ))}
        </div>
        {scope === "equipo" && (
          <form action="/tareas" className="flex items-center gap-2">
            <input type="hidden" name="ambito" value="equipo" />
            {matterId && <input type="hidden" name="expediente" value={matterId} />}
            <select className="input py-1.5" name="persona" defaultValue={personId ?? ""} aria-label="Persona">
              <option value="">Todas las personas</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button className="btn-secondary btn-sm">Filtrar</button>
          </form>
        )}
        {matterId && (
          <Link href={qs({ expediente: null })} className="badge-blue">
            {matterLabel ?? `Expediente #${matterId}`} ✕
          </Link>
        )}
      </div>

      <details className="card mb-5" open={tasks.length === 0}>
        <summary className="cursor-pointer list-none px-5 py-3 font-semibold">+ Nueva tarea</summary>
        <ActionForm action={quickTaskAction} resetOnSuccess className="grid gap-3 border-t border-ink-100 px-5 py-4 sm:grid-cols-6 sm:items-end">
          <Field label="Tarea" className="sm:col-span-6">
            <input className="input" name="title" required minLength={3} maxLength={250} placeholder="Llamar al perito, preparar prueba testimonial…" />
          </Field>
          <Field label="Expediente" className="sm:col-span-2">
            <select className="input" name="matterId" defaultValue={matterId ?? ""}>
              <option value="">Sin expediente</option>
              {options.matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable" className="sm:col-span-2">
            <select className="input" name="assignedId" defaultValue={user.id}>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="input" name="priority" defaultValue="normal">
              {Object.entries(TASK_PRIORITIES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha límite">
            <input className="input" type="date" name="due" required defaultValue={addDaysISO(today, 3)} />
          </Field>
          <div className="sm:col-span-6">
            <SubmitButton>Crear tarea</SubmitButton>
            <span className="ml-3 text-xs text-ink-500">Si se la asignas a otra persona, le llega un aviso por correo.</span>
          </div>
        </ActionForm>
      </details>

      <TaskBoard tasks={tasks} />
    </>
  );
}
