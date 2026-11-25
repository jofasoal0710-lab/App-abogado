import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, events, matterNotes, matters, runningTimers, timeEntries, users } from "@/db/schema";
import { canAccessEvent, canAccessMatterOrNone, canUserIdAccessMatter, getAccessibleMatter, matterAccessSql } from "./access";
import type { CurrentUser } from "./auth";
import { describeDate, describeMinutes, STATUS_LABELS, type MatterRef, type ParsedCommand } from "./assistant-commands";
import { stampSessionActor } from "./data-audit";
import { todayISO } from "./dates";
import { formatDuration, parseDurationToMinutes } from "./money";
import { likePattern } from "./search";
import { notifyTaskAssigned } from "./task-mail";
import { statusPatch, TASK_PRIORITIES } from "./tasks";
import { elapsedSeconds, formatClock } from "./timer";

/* ---------------- Tipos compartidos con el chat ---------------- */

export type ChatContext = { matterId?: number; matterNumber?: string };
export type ProposalField = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "date" | "time" | "select" | "duration" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
};
/** Una orden lista para confirmar: qué se va a hacer, con los datos editables. */
export type Proposal = { summary: string; cmd: Record<string, string>; fields: ProposalField[]; confirmLabel: string; understood: string[] };
export type ExecAnswer = { text: string; items?: { label: string; detail?: string; href?: string }[]; suggestions?: string[]; proposal?: Proposal; context?: ChatContext };

const PRIORITY_OPTIONS = Object.entries(TASK_PRIORITIES).map(([value, label]) => ({ value, label }));
const KIND_OPTIONS = [
  { value: "plazo", label: "Plazo" },
  { value: "audiencia", label: "Audiencia" },
  { value: "reunion", label: "Reunión" },
];
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const DEFAULT_TIME = { tarea: "17:00", plazo: "16:00", audiencia: "09:00", reunion: "10:00" } as const;

type MatterLite = { id: number; number: string; title: string };

/* ---------------- Resolver expedientes y personas ---------------- */

/** El expediente al que se refiere la orden, entre los que la persona puede ver. */
async function resolveMatter(user: CurrentUser, ref: MatterRef | null, ctx: ChatContext): Promise<{ matter: MatterLite | null; options: MatterLite[]; note?: string }> {
  const pick = { id: matters.id, number: matters.number, title: matters.title };
  if (ref?.kind === "numero") {
    const [m] = await db.select(pick).from(matters).where(and(eq(matters.number, ref.number), matterAccessSql(user, matters.id)));
    return m ? { matter: m, options: [m] } : { matter: null, options: await recentMatters(user), note: `No encuentro el ${ref.number} entre los expedientes que puedes ver.` };
  }
  if (ref?.kind === "contexto") {
    if (ctx.matterId) {
      const [m] = await db.select(pick).from(matters).where(and(eq(matters.id, ctx.matterId), matterAccessSql(user, matters.id)));
      if (m) return { matter: m, options: [m] };
    }
    return { matter: null, options: await recentMatters(user), note: "No sé a qué expediente te refieres: elígelo en la lista." };
  }
  if (ref?.kind === "texto") {
    const words = ref.text.split(/\s+/).filter((w) => w.length >= 3).slice(0, 4);
    const conds = words.map((w) => or(ilike(matters.title, likePattern(w)), ilike(clients.name, likePattern(w)), ilike(matters.number, likePattern(w))));
    const found = conds.length
      ? await db.select(pick).from(matters).innerJoin(clients, eq(clients.id, matters.clientId)).where(and(...conds, matterAccessSql(user, matters.id))).orderBy(desc(matters.createdAt)).limit(8)
      : [];
    if (found.length === 1) return { matter: found[0], options: found };
    if (found.length > 1) return { matter: null, options: found, note: `Hay ${found.length} expedientes que encajan con «${ref.text}»: elige uno.` };
    return { matter: null, options: await recentMatters(user), note: `No encuentro un expediente que encaje con «${ref.text}».` };
  }
  // Sin expediente: si en la conversación había uno, se propone ese.
  if (ctx.matterId) {
    const [m] = await db.select(pick).from(matters).where(and(eq(matters.id, ctx.matterId), matterAccessSql(user, matters.id)));
    if (m) return { matter: null, options: [m, ...(await recentMatters(user)).filter((x) => x.id !== m.id)] };
  }
  return { matter: null, options: await recentMatters(user) };
}

/** Expedientes activos recientes de la persona (responsable o con horas suyas), para elegir rápido. */
async function recentMatters(user: CurrentUser): Promise<MatterLite[]> {
  return db
    .select({ id: matters.id, number: matters.number, title: matters.title })
    .from(matters)
    .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id)))
    .orderBy(sql`(${matters.responsibleId} = ${user.id}) desc`, desc(matters.createdAt))
    .limit(12);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function resolveUser(user: CurrentUser, name: string | null): Promise<{ id: number; name: string; note?: string }> {
  if (!name || name === "@yo") return { id: user.id, name: user.name };
  const team = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true));
  const q = fold(name).split(" ");
  const hits = team.filter((u) => q.every((w) => fold(u.name).split(/\s+/).some((p) => p.startsWith(w))));
  if (hits.length === 1) return hits[0];
  return { id: user.id, name: user.name, note: hits.length ? `Hay varias personas llamadas «${name}»: elige la correcta.` : `No encuentro a «${name}» en el equipo: elige a quién asignarla.` };
}

async function teamOptions() {
  return (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name))).map((u) => ({ value: String(u.id), label: u.name }));
}
const matterOptions = (list: MatterLite[], optional: boolean) => [...(optional ? [{ value: "", label: "— Sin expediente —" }] : []), ...list.map((m) => ({ value: String(m.id), label: `${m.number} · ${m.title}` }))];
const ctxOf = (m: MatterLite | null): ChatContext | undefined => (m ? { matterId: m.id, matterNumber: m.number } : undefined);

/* ---------------- De la orden entendida a la propuesta ---------------- */

/** Prepara la confirmación (o responde directamente si es una consulta). Nunca cambia nada. */
export async function commandAnswer(user: CurrentUser, c: ParsedCommand, ctx: ChatContext): Promise<ExecAnswer> {
  const today = todayISO();
  switch (c.type) {
    case "mis_tareas":
      return myTasks(user, c.scope);
    case "mis_horas":
      return myHours(user, c.period);
    case "tarea":
    case "evento": {
      const { matter, options, note } = await resolveMatter(user, c.matter, ctx);
      const who = await resolveUser(user, c.assignee);
      const kind = c.type === "tarea" ? "tarea" : c.kind;
      const date = c.date ?? today;
      const time = c.time ?? DEFAULT_TIME[kind];
      const understood = [
        c.type === "tarea" ? "Tarea" : KIND_OPTIONS.find((k) => k.value === kind)!.label,
        c.title ? `«${c.title}»` : "sin título (escríbelo)",
        `${describeDate(date)}${c.date ? "" : " (no dijiste fecha: hoy)"} a las ${time}${c.time ? "" : " (hora por defecto)"}`,
        matter ? `en ${matter.number}` : "sin expediente",
        `para ${who.id === user.id ? "ti" : who.name}`,
        ...(c.type === "tarea" && c.priority ? [`prioridad ${TASK_PRIORITIES[c.priority].toLowerCase()}`] : []),
      ];
      return {
        text: [note, who.note].filter(Boolean).join(" ") || "Esto es lo que voy a crear. Revisa y confirma:",
        proposal: {
          summary: `${understood[0]} ${understood[1]}`,
          understood,
          confirmLabel: c.type === "tarea" ? "Crear la tarea" : `Crear ${kind === "reunion" ? "la reunión" : kind === "audiencia" ? "la audiencia" : "el plazo"}`,
          cmd: { type: "evento", kind, title: c.title, date, time, matterId: matter ? String(matter.id) : "", assignedId: String(who.id), priority: c.type === "tarea" ? (c.priority ?? "normal") : kind === "plazo" ? "alta" : "normal" },
          fields: [
            ...(c.type === "evento" ? [{ name: "kind", label: "Tipo", kind: "select" as const, options: KIND_OPTIONS }] : []),
            { name: "title", label: "Título", kind: "text", required: true },
            { name: "date", label: "Fecha", kind: "date", required: true },
            { name: "time", label: "Hora", kind: "time", required: true },
            { name: "matterId", label: "Expediente", kind: "select", options: matterOptions(matter ? [matter, ...options.filter((o) => o.id !== matter.id)] : options, true) },
            { name: "assignedId", label: "Asignada a", kind: "select", options: await teamOptions() },
            ...(c.type === "tarea" ? [{ name: "priority", label: "Prioridad", kind: "select" as const, options: PRIORITY_OPTIONS }] : []),
          ],
        },
        context: ctxOf(matter),
      };
    }
    case "horas": {
      const { matter, options, note } = await resolveMatter(user, c.matter, ctx);
      const understood = [
        c.minutes ? describeMinutes(c.minutes) : "duración sin indicar",
        c.date ? describeDate(c.date) : `hoy (${describeDate(today)})`,
        matter ? `en ${matter.number}` : "falta el expediente",
        c.description ? `«${c.description}»` : "falta la descripción del trabajo",
        c.billable === false ? "no facturables" : "facturables",
      ];
      return {
        text: note ?? (matter && c.minutes && c.description ? "Voy a registrar estas horas. Revisa y confirma:" : "Me falta algún dato: complétalo y confirma."),
        proposal: {
          summary: `Registrar ${understood[0]}`,
          understood,
          confirmLabel: "Registrar las horas",
          cmd: { type: "horas", matterId: matter ? String(matter.id) : options[0] ? String(options[0].id) : "", duration: c.minutes ? `${Math.floor(c.minutes / 60)}:${String(c.minutes % 60).padStart(2, "0")}` : "", date: c.date ?? today, description: c.description, billable: c.billable === false ? "" : "on" },
          fields: [
            { name: "matterId", label: "Expediente", kind: "select", options: matterOptions(matter ? [matter, ...options.filter((o) => o.id !== matter.id)] : options, false), required: true },
            { name: "duration", label: "Duración (h:mm)", kind: "duration", required: true },
            { name: "date", label: "Fecha", kind: "date", required: true },
            { name: "description", label: "Trabajo realizado", kind: "text", required: true },
            { name: "billable", label: "Facturable", kind: "checkbox" },
          ],
        },
        context: ctxOf(matter),
      };
    }
    case "nota": {
      const { matter, options, note } = await resolveMatter(user, c.matter, ctx);
      return {
        text: note ?? "Voy a añadir esta nota. Revisa y confirma:",
        proposal: {
          summary: "Añadir una nota",
          understood: [matter ? `en ${matter.number}` : "falta el expediente", c.body ? `«${c.body.slice(0, 80)}${c.body.length > 80 ? "…" : ""}»` : "falta el texto"],
          confirmLabel: "Añadir la nota",
          cmd: { type: "nota", matterId: matter ? String(matter.id) : options[0] ? String(options[0].id) : "", body: c.body },
          fields: [
            { name: "matterId", label: "Expediente", kind: "select", options: matterOptions(matter ? [matter, ...options.filter((o) => o.id !== matter.id)] : options, false), required: true },
            { name: "body", label: "Nota", kind: "textarea", required: true },
          ],
        },
        context: ctxOf(matter),
      };
    }
    case "estado": {
      const { matter, options, note } = await resolveMatter(user, c.matter, ctx);
      return {
        text: note ?? `Voy a pasar el expediente a «${STATUS_LABELS[c.status]}». Confirma:`,
        proposal: {
          summary: `Cambiar el estado a «${STATUS_LABELS[c.status]}»`,
          understood: [matter ? `${matter.number} · ${matter.title}` : "falta el expediente", `nuevo estado: ${STATUS_LABELS[c.status]}`],
          confirmLabel: "Cambiar el estado",
          cmd: { type: "estado", matterId: matter ? String(matter.id) : "", status: c.status },
          fields: [
            { name: "matterId", label: "Expediente", kind: "select", options: matterOptions(matter ? [matter, ...options.filter((o) => o.id !== matter.id)] : options, false), required: true },
            { name: "status", label: "Estado", kind: "select", options: STATUS_OPTIONS },
          ],
        },
        context: ctxOf(matter),
      };
    }
    case "completar": {
      const words = c.what.split(/\s+/).filter((w) => w.length >= 3).slice(0, 5);
      const { matter } = c.matter ? await resolveMatter(user, c.matter, ctx) : { matter: null };
      const found = await db
        .select({ id: events.id, title: events.title, startsAt: events.startsAt, number: matters.number })
        .from(events)
        .leftJoin(matters, eq(matters.id, events.matterId))
        .where(
          and(
            ne(events.status, "hecha"),
            eq(events.completed, false),
            inArray(events.kind, ["tarea", "plazo"]),
            or(eq(events.assignedId, user.id), eq(events.createdById, user.id)),
            matterAccessSql(user, events.matterId, { orNone: true }),
            ...(matter ? [eq(events.matterId, matter.id)] : []),
            ...words.map((w) => ilike(events.title, likePattern(w))),
          ),
        )
        .orderBy(asc(events.startsAt))
        .limit(8);
      if (!found.length) return { text: `No encuentro ninguna tarea o plazo tuyo pendiente que encaje con «${c.what}».`, items: [{ label: "Ver mis tareas", href: "/tareas" }], suggestions: ["Mis tareas"] };
      return {
        text: found.length === 1 ? "Voy a marcar como hecha esta tarea. Confirma:" : `Encontré ${found.length} pendientes que encajan: elige cuál.`,
        proposal: {
          summary: "Marcar como hecha",
          understood: [`buscando «${c.what}»`, `${found.length} coincidencia${found.length === 1 ? "" : "s"}`],
          confirmLabel: "Marcar como hecha",
          cmd: { type: "completar", eventId: String(found[0].id) },
          fields: [{ name: "eventId", label: "Tarea o plazo", kind: "select", options: found.map((f) => ({ value: String(f.id), label: `${f.title} · ${describeDate(todayOf(f.startsAt))}${f.number ? ` · ${f.number}` : ""}` })) }],
        },
      };
    }
    case "cronometro":
      return timerAnswer(user, c, ctx);
  }
}

const todayOf = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

async function timerAnswer(user: CurrentUser, c: Extract<ParsedCommand, { type: "cronometro" }>, ctx: ChatContext): Promise<ExecAnswer> {
  const [t] = await db.select({ matterId: runningTimers.matterId, startedAt: runningTimers.startedAt, accumulatedSeconds: runningTimers.accumulatedSeconds, description: runningTimers.description, number: matters.number }).from(runningTimers).innerJoin(matters, eq(matters.id, runningTimers.matterId)).where(eq(runningTimers.userId, user.id));
  const state = t ? `${t.startedAt ? "en marcha" : "en pausa"} · ${formatClock(elapsedSeconds(t, new Date()))} · ${t.number}` : null;
  if (c.op === "ver") return { text: t ? `Tu cronómetro está ${state}.` : "No tienes ningún cronómetro en marcha.", suggestions: t ? ["Pausa el cronómetro", "Detén el cronómetro"] : ["Inicia el cronómetro"] };
  if (c.op === "iniciar") {
    if (t) return { text: `Ya tienes un cronómetro ${state}. Detenlo o descártalo antes de empezar otro.`, suggestions: ["Detén el cronómetro", "Descarta el cronómetro"] };
    const { matter, options, note } = await resolveMatter(user, c.matter, ctx);
    return {
      text: note ?? "Voy a iniciar el cronómetro. Confirma:",
      proposal: {
        summary: "Iniciar el cronómetro",
        understood: [matter ? `en ${matter.number}` : "falta el expediente"],
        confirmLabel: "Iniciar",
        cmd: { type: "cronometro", op: "iniciar", matterId: matter ? String(matter.id) : options[0] ? String(options[0].id) : "", description: c.description },
        fields: [
          { name: "matterId", label: "Expediente", kind: "select", options: matterOptions(matter ? [matter, ...options.filter((o) => o.id !== matter.id)] : options, false), required: true },
          { name: "description", label: "Qué vas a hacer (opcional)", kind: "text" },
        ],
      },
      context: ctxOf(matter),
    };
  }
  if (!t) return { text: "No tienes ningún cronómetro en marcha.", suggestions: ["Inicia el cronómetro"] };
  if (c.op === "pausar" || c.op === "reanudar") {
    if ((c.op === "pausar") !== !!t.startedAt) return { text: `El cronómetro ya está ${t.startedAt ? "en marcha" : "en pausa"}.` };
    return executeCommand(user, { type: "cronometro", op: c.op });
  }
  if (c.op === "descartar")
    return { text: `Vas a descartar el cronómetro (${state}) sin registrar nada.`, proposal: { summary: "Descartar el cronómetro", understood: [state!], confirmLabel: "Descartar", cmd: { type: "cronometro", op: "descartar" }, fields: [] } };
  return {
    text: `Voy a detener el cronómetro (${state}) y registrar las horas en ${t.number}. Confirma:`,
    proposal: {
      summary: "Detener y registrar",
      understood: [state!],
      confirmLabel: "Detener y registrar",
      cmd: { type: "cronometro", op: "detener", description: c.description || t.description, billable: "on" },
      fields: [
        { name: "description", label: "Trabajo realizado", kind: "text", required: true },
        { name: "billable", label: "Facturable", kind: "checkbox" },
      ],
    },
  };
}

/* ---------------- Consultas propias ---------------- */

async function myTasks(user: CurrentUser, scope: "hoy" | "semana" | "todas" | "vencidas"): Promise<ExecAnswer> {
  const sod = new Date(new Date().setHours(0, 0, 0, 0));
  const range = scope === "hoy" ? [gte(events.startsAt, sod), lt(events.startsAt, new Date(sod.getTime() + 86_400_000))] : scope === "semana" ? [lt(events.startsAt, new Date(sod.getTime() + 7 * 86_400_000))] : scope === "vencidas" ? [lt(events.startsAt, sod)] : [];
  const rows = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, priority: events.priority, number: matters.number })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .where(and(eq(events.kind, "tarea"), eq(events.assignedId, user.id), ne(events.status, "hecha"), matterAccessSql(user, events.matterId, { orNone: true }), ...range))
    .orderBy(asc(events.startsAt))
    .limit(15);
  const label = { hoy: "para hoy", semana: "para esta semana", todas: "pendientes", vencidas: "vencidas" }[scope];
  if (!rows.length) return { text: `No tienes tareas ${label}.`, suggestions: ["Crea una tarea para mañana: …", "Mis horas de hoy"] };
  return {
    text: `Tienes ${rows.length} tarea${rows.length === 1 ? "" : "s"} ${label}:`,
    items: rows.map((r) => ({ label: r.title, detail: `${describeDate(todayOf(r.startsAt))}${r.number ? ` · ${r.number}` : ""} · ${TASK_PRIORITIES[r.priority]}${r.startsAt < sod ? " · VENCIDA" : ""}`, href: "/tareas" })),
    suggestions: [`Marca como hecha la tarea ${rows[0].title}`, "Mis tareas vencidas"],
  };
}

async function myHours(user: CurrentUser, period: "hoy" | "semana" | "mes"): Promise<ExecAnswer> {
  const today = todayISO();
  const d = new Date(`${today}T12:00:00Z`);
  const from = period === "hoy" ? today : period === "mes" ? `${today.slice(0, 7)}-01` : new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ number: matters.number, minutes: sql<number>`sum(${timeEntries.minutes})::int` })
    .from(timeEntries)
    .innerJoin(matters, eq(matters.id, timeEntries.matterId))
    .where(and(eq(timeEntries.userId, user.id), gte(timeEntries.workedOn, from), matterAccessSql(user, matters.id)))
    .groupBy(matters.number)
    .orderBy(desc(sql`sum(${timeEntries.minutes})`));
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const label = { hoy: "hoy", semana: "esta semana", mes: "este mes" }[period];
  return {
    text: total ? `Llevas ${formatDuration(total)} registradas ${label}:` : `No tienes horas registradas ${label}.`,
    items: rows.map((r) => ({ label: r.number, detail: formatDuration(r.minutes), href: "/horas" })),
    suggestions: ["Registra 1 hora en …", "Inicia el cronómetro"],
  };
}

/* ---------------- Ejecutar (tras la confirmación) ---------------- */

const id = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora no es válida.");
const ExecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("evento"), kind: z.enum(["tarea", "plazo", "audiencia", "reunion"]), title: z.string().trim().min(3, "Escribe el título (mínimo 3 caracteres).").max(250), date: isoDate, time: hhmm, matterId: z.union([z.literal(""), id]), assignedId: id, priority: z.enum(["baja", "normal", "alta", "urgente"]) }),
  z.object({ type: z.literal("horas"), matterId: id, duration: z.string(), date: isoDate, description: z.string().trim().min(3, "Describe el trabajo realizado (mínimo 3 caracteres).").max(1000), billable: z.string().optional() }),
  z.object({ type: z.literal("nota"), matterId: id, body: z.string().trim().min(2, "Escribe la nota.").max(10000) }),
  z.object({ type: z.literal("estado"), matterId: id, status: z.enum(["abierto", "en_curso", "en_espera", "cerrado", "archivado"]) }),
  z.object({ type: z.literal("completar"), eventId: id }),
  z.object({ type: z.literal("cronometro"), op: z.enum(["iniciar", "pausar", "reanudar", "detener", "descartar"]), matterId: z.union([z.literal(""), id]).optional(), description: z.string().max(1000).optional(), billable: z.string().optional() }),
]);

/** Ejecuta una orden confirmada. Todo se valida de nuevo aquí: el navegador no es de fiar. */
export async function executeCommand(user: CurrentUser, raw: unknown): Promise<ExecAnswer> {
  const parsed = ExecSchema.safeParse(raw);
  if (!parsed.success) return { text: `No se pudo hacer: ${parsed.error.issues[0]?.message ?? "datos no válidos"}` };
  const c = parsed.data;
  const DENIED = { text: "No tienes acceso a ese expediente." };
  switch (c.type) {
    case "evento": {
      const matterId = c.matterId === "" ? null : c.matterId;
      if (!(await canAccessMatterOrNone(user, matterId))) return DENIED;
      const [who] = await db.select({ id: users.id, name: users.name, active: users.active }).from(users).where(eq(users.id, c.assignedId));
      if (!who?.active) return { text: "La persona asignada no está activa en el equipo." };
      if (matterId && who.id !== user.id && !(await canUserIdAccessMatter(who.id, matterId))) return { text: `${who.name} no tiene acceso a ese expediente: asígnala a otra persona o dale acceso primero.` };
      const [created] = await db
        .insert(events)
        .values({ kind: c.kind, title: c.title, startsAt: new Date(`${c.date}T${c.time}:00`), matterId, assignedId: who.id, createdById: user.id, priority: c.priority })
        .returning({ id: events.id });
      const mailed = who.id !== user.id ? await notifyTaskAssigned(created.id, user) : false;
      revalidatePath("/tareas");
      revalidatePath("/agenda");
      if (matterId) revalidatePath(`/expedientes/${matterId}`);
      const what = c.kind === "tarea" ? "Tarea creada" : c.kind === "audiencia" ? "Audiencia agendada" : c.kind === "reunion" ? "Reunión agendada" : "Plazo añadido al Control de plazos";
      const [m] = matterId ? await db.select({ id: matters.id, number: matters.number }).from(matters).where(eq(matters.id, matterId)) : [];
      return {
        text: `✓ ${what}: «${c.title}», ${describeDate(c.date)} a las ${c.time}${who.id !== user.id ? `, asignada a ${who.name}${mailed ? " (avisada por correo)" : ""}` : ""}.`,
        items: [{ label: c.kind === "tarea" ? "Ver mis tareas" : "Ver el Control de plazos", href: c.kind === "tarea" ? "/tareas" : "/agenda" }, ...(m ? [{ label: `Abrir ${m.number}`, href: `/expedientes/${m.id}` }] : [])],
        suggestions: ["Mis tareas", "Crea otra tarea para mañana: …"],
        context: m ? { matterId: m.id, matterNumber: m.number } : undefined,
      };
    }
    case "horas": {
      const minutes = parseDurationToMinutes(c.duration);
      if (minutes === null || minutes <= 0 || minutes > 24 * 60) return { text: "La duración no es válida (por ejemplo 1:30 o 2h)." };
      if (c.date > todayISO()) return { text: "No se pueden registrar horas en una fecha futura." };
      const matter = await getAccessibleMatter(user, c.matterId);
      if (!matter) return DENIED;
      const rateCents = matter.billingType === "por_horas" && matter.hourlyRateCents ? matter.hourlyRateCents : user.hourlyRateCents;
      await db.insert(timeEntries).values({ matterId: matter.id, userId: user.id, workedOn: c.date, minutes, description: c.description, rateCents, billable: c.billable === "on" });
      revalidatePath("/horas");
      revalidatePath(`/expedientes/${matter.id}`);
      return {
        text: `✓ Registradas ${formatDuration(minutes)} en ${matter.number} (${describeDate(c.date)}): «${c.description}».`,
        items: [{ label: `Horas de ${matter.number}`, href: `/expedientes/${matter.id}?tab=horas` }],
        suggestions: ["Mis horas de hoy", "Mis horas de esta semana"],
        context: { matterId: matter.id, matterNumber: matter.number },
      };
    }
    case "nota": {
      const matter = await getAccessibleMatter(user, c.matterId);
      if (!matter) return DENIED;
      await db.insert(matterNotes).values({ matterId: matter.id, authorId: user.id, body: c.body });
      revalidatePath(`/expedientes/${matter.id}`);
      return { text: `✓ Nota añadida a ${matter.number}.`, items: [{ label: `Abrir ${matter.number}`, href: `/expedientes/${matter.id}` }], context: { matterId: matter.id, matterNumber: matter.number } };
    }
    case "estado": {
      const matter = await getAccessibleMatter(user, c.matterId);
      if (!matter) return DENIED;
      const closing = c.status === "cerrado" || c.status === "archivado";
      await db.transaction(async (tx) => {
        await stampSessionActor(tx);
        await tx.update(matters).set({ status: c.status, closedAt: closing ? todayISO() : null }).where(eq(matters.id, matter.id));
      });
      revalidatePath("/expedientes");
      revalidatePath(`/expedientes/${matter.id}`);
      return { text: `✓ ${matter.number} ahora está «${STATUS_LABELS[c.status]}».`, items: [{ label: `Abrir ${matter.number}`, href: `/expedientes/${matter.id}` }], context: { matterId: matter.id, matterNumber: matter.number } };
    }
    case "completar": {
      if (!(await canAccessEvent(user, c.eventId))) return { text: "No tienes acceso a esa tarea." };
      const [e] = await db
        .update(events)
        .set({ ...statusPatch("hecha", new Date()) })
        .where(and(eq(events.id, c.eventId), ne(events.status, "hecha")))
        .returning({ title: events.title, matterId: events.matterId });
      revalidatePath("/tareas");
      revalidatePath("/agenda");
      if (e?.matterId) revalidatePath(`/expedientes/${e.matterId}`);
      return e ? { text: `✓ «${e.title}» marcada como hecha.`, suggestions: ["Mis tareas"] } : { text: "Esa tarea ya estaba hecha." };
    }
    case "cronometro": {
      const { startTimerAction, stopTimerAction, toggleTimerAction, discardTimerAction } = await import("@/app/(app)/horas/timer-actions");
      if (c.op === "iniciar") {
        if (!c.matterId) return { text: "Elige el expediente." };
        const fd = new FormData();
        fd.set("timerNote", c.description ?? "");
        const r = await startTimerAction(c.matterId, undefined, fd);
        if (r?.error) return { text: r.error };
        const [m] = await db.select({ id: matters.id, number: matters.number }).from(matters).where(eq(matters.id, c.matterId));
        return { text: `✓ Cronómetro en marcha en ${m?.number}.`, suggestions: ["Pausa el cronómetro", "Detén el cronómetro"], context: m ? { matterId: m.id, matterNumber: m.number } : undefined };
      }
      if (c.op === "pausar" || c.op === "reanudar") {
        await toggleTimerAction();
        return { text: c.op === "pausar" ? "⏸ Cronómetro en pausa." : "▶ Cronómetro en marcha de nuevo.", suggestions: [c.op === "pausar" ? "Reanuda el cronómetro" : "Pausa el cronómetro", "Detén el cronómetro"] };
      }
      if (c.op === "descartar") {
        await discardTimerAction();
        return { text: "✓ Cronómetro descartado (no se registró nada)." };
      }
      const fd = new FormData();
      fd.set("timerDescription", c.description ?? "");
      if (c.billable === "on") fd.set("billable", "on");
      const r = await stopTimerAction(undefined, fd);
      return r?.error ? { text: r.error } : { text: `✓ ${r?.ok ?? "Horas registradas."}`, suggestions: ["Mis horas de hoy"] };
    }
  }
}

