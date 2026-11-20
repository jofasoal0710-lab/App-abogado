import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, deedParties, deeds, events, invoices, matterCitations, matters, testimonies, timeEntries, users, writings } from "@/db/schema";
import { getTemplate, TEMPLATES } from "./forms/templates";
import { getNotaryProfile, nextDeedNumber, pendingIndexes } from "./notary";
import { citationText, getNorm, NORM_AREAS, normLabel, searchNorms } from "./normativa";
import { articlesByNumber, loadedLaws, searchArticles } from "./laws";
import { bestPassage, detectProcedure, expandQuery, extractDate, extractDuration, extractSettlement } from "./assistant-reason";
import { laborSettlement, procedureDeadline } from "./calculators";
import { holidayName } from "./cr-holidays";
import { parseRefs, searchKnowledge } from "./knowledge";
import { quincenaOf } from "./notary-period";
import { writingAccessSql } from "./writings";
import { clientAccessSql, invoiceAccessSql, matterAccessSql } from "./access";
import { parseIntent, type Intent } from "./assistant-intent";
import type { CurrentUser } from "./auth";
import { formatId } from "./cr-id";
import { formatDate, formatDateTime, todayISO } from "./dates";
import { loadAdjustments } from "./invoice-queries";
import { summarizeInvoice } from "./invoices";
import { areaLabels, eventKindLabels, matterStatusLabels } from "./labels";
import { formatDuration, formatMoney } from "./money";
import { can } from "./permissions";
import { logRead } from "./read-audit";
import { likePattern } from "./search";

export type AssistantItem = { label: string; detail?: string; href?: string };
export type AssistantAnswer = { text: string; items?: AssistantItem[]; suggestions?: string[] };

const ACTIVE = ["abierto", "en_curso", "en_espera"] as const;
const HELP_SUGGESTIONS = ["Resumen", "Plazos de esta semana", "Facturas pendientes", "Expedientes activos"];
const NO_BILLING = "No tienes permiso para ver la facturación.";

/** Responde a una pregunta con los datos que la persona puede ver (mismas reglas que el resto de la app). */
export async function answer(user: CurrentUser, question: string): Promise<AssistantAnswer> {
  const intent = parseIntent(question);
  const res = await route(user, question, intent);
  // Si se interpretó como un nombre de cliente que no existe («¿cuánto cobramos por la consulta?»),
  // quizá era una pregunta para la base de conocimiento. (Nunca con expedientes: un «no encuentro»
  // ahí es la respuesta correcta, también cuando es confidencial.)
  if ((intent.kind === "cliente" || intent.kind === "facturas_pendientes") && /^No (encuentro|he entendido)/.test(res.text))
    return (await legalAnswer(user, question, { quiet: true })) ?? res;
  return res;
}

async function route(user: CurrentUser, question: string, intent: ReturnType<typeof parseIntent>): Promise<AssistantAnswer> {
  switch (intent.kind) {
    case "ayuda":
      return help();
    case "resumen":
      return summary(user);
    case "expediente":
      return matterInfo(user, intent);
    case "cliente":
      return clientInfo(user, intent.query);
    case "facturas_pendientes":
      return pendingInvoices(user, intent.client, false);
    case "facturas_vencidas":
      return pendingInvoices(user, null, true);
    case "plazos":
      return deadlines(user, intent.days);
    case "expedientes_activos":
      return activeMatters(user);
    case "buscar": {
      // Primero, por si es una pregunta de conocimiento; si no, se buscan expedientes y clientes.
      const k = await legalAnswer(user, question, { quiet: true });
      return k ?? search(user, intent.query);
    }
    case "formularios":
      return formsList();
    case "generar":
      return generateLink(user, intent.template, intent.ref);
    case "escritos":
      return matterWritings(user, intent.ref);
    case "notaria":
      return notaryInfo(user, intent.what);
    case "normativa":
      return normativa(user, intent.query, intent.ref, intent.article);
    case "consulta":
      return (await legalAnswer(user, intent.question))!;
    case "liquidacion":
      return settlementAnswer(intent.question);
  }
}

function help(): AssistantAnswer {
  return {
    text:
      "Puedo ayudarte con:\n- El despacho (con tus permisos): «estado del EXP-2026-0001», «cliente Gerson», «¿cuánto debe Gerson?», «plazos de esta semana», «escritos del EXP-2026-0001», «próxima escritura».\n- Dudas jurídicas, con la base de conocimiento y las leyes cargadas: «¿cuánto tengo para apelar una sentencia?», «¿cuándo prescribe un reclamo laboral?», «artículo 29 del código de trabajo».\n- Cálculos: «me notificaron el 20/11, ¿cuándo vence la apelación?», «liquidación de 3 años y 7 meses con salario de 600 000».\n- Redactar: «genera una demanda laboral para EXP-2026-0001».\nLo que el despacho añada en Conocimiento, lo uso para responder.",
    suggestions: [...HELP_SUGGESTIONS, "¿Cuánto tengo para apelar una sentencia?", "Formularios"],
  };
}

async function summary(user: CurrentUser): Promise<AssistantAnswer> {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const [[active], [weekEvents], [unbilled]] = await Promise.all([
    db.select({ n: count() }).from(matters).where(and(inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id))),
    db
      .select({ n: count() })
      .from(events)
      .where(and(eq(events.completed, false), gte(events.startsAt, now), lt(events.startsAt, in7), matterAccessSql(user, events.matterId, { orNone: true }))),
    db
      .select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` })
      .from(timeEntries)
      .where(and(eq(timeEntries.billable, true), isNull(timeEntries.invoiceId), matterAccessSql(user, timeEntries.matterId))),
  ]);
  const items: AssistantItem[] = [
    { label: `${active.n} expedientes activos`, href: "/expedientes" },
    { label: `${weekEvents.n} eventos y plazos en los próximos 7 días`, href: "/agenda" },
    { label: `${formatDuration(unbilled.minutes)} de horas facturables sin facturar`, href: "/horas?todos=1" },
  ];
  if (can(user, "facturacion.ver")) {
    const { outstanding, overdue } = await outstandingInvoices(user, null);
    const total = outstanding.reduce((s, x) => s + x.pending, 0);
    items.push({ label: `${formatMoney(total)} pendiente de cobro en ${outstanding.length} facturas`, detail: overdue.length ? `${overdue.length} vencidas` : "ninguna vencida", href: "/facturas?estado=emitida" });
  }
  return { text: "Así está el despacho ahora mismo:", items, suggestions: ["Plazos de esta semana", "Facturas vencidas", "Expedientes activos"] };
}

async function matterInfo(user: CurrentUser, intent: Extract<Intent, { kind: "expediente" }>): Promise<AssistantAnswer> {
  const byNumber = /^EXP-\d{4}-\d{4}$/.test(intent.ref);
  const found = await db
    .select({
      id: matters.id,
      number: matters.number,
      title: matters.title,
      status: matters.status,
      area: matters.area,
      visibility: matters.visibility,
      court: matters.court,
      caseNumber: matters.courtCaseNumber,
      openedAt: matters.openedAt,
      client: clients.name,
      responsible: users.name,
    })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .leftJoin(users, eq(users.id, matters.responsibleId))
    .where(
      and(
        byNumber ? eq(matters.number, intent.ref) : or(ilike(matters.title, likePattern(intent.ref)), ilike(clients.name, likePattern(intent.ref))),
        matterAccessSql(user, matters.id),
      ),
    )
    .orderBy(desc(matters.openedAt))
    .limit(6);

  if (found.length === 0) return { text: `No encuentro ningún expediente «${intent.ref}» que puedas ver.`, suggestions: ["Expedientes activos"] };
  if (found.length > 1) {
    return {
      text: `Hay ${found.length} expedientes que coinciden. ¿Cuál te interesa?`,
      items: found.map((m) => ({ label: `${m.number} · ${m.title}`, detail: `${m.client} · ${matterStatusLabels[m.status]}`, href: `/expedientes/${m.id}` })),
      suggestions: found.slice(0, 3).map((m) => `Expediente ${m.number}`),
    };
  }

  const m = found[0];
  const [[next], [hours]] = await Promise.all([
    db
      .select({ title: events.title, kind: events.kind, startsAt: events.startsAt })
      .from(events)
      .where(and(eq(events.matterId, m.id), eq(events.completed, false), gte(events.startsAt, new Date())))
      .orderBy(asc(events.startsAt))
      .limit(1),
    db
      .select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` })
      .from(timeEntries)
      .where(and(eq(timeEntries.matterId, m.id), eq(timeEntries.billable, true), isNull(timeEntries.invoiceId))),
  ]);
  const items: AssistantItem[] = [
    { label: "Estado", detail: matterStatusLabels[m.status] },
    { label: "Cliente", detail: m.client },
    { label: "Área", detail: areaLabels[m.area] },
    { label: "Responsable", detail: m.responsible ?? "Sin asignar" },
    ...(m.court || m.caseNumber ? [{ label: "Juzgado / procedimiento", detail: [m.court, m.caseNumber].filter(Boolean).join(" · ") }] : []),
    { label: "Próximo evento", detail: next ? `${eventKindLabels[next.kind]}: ${next.title} — ${formatDateTime(next.startsAt)}` : "Ninguno pendiente" },
    { label: "Horas sin facturar", detail: formatDuration(hours.minutes) },
  ];
  if (can(user, "facturacion.ver")) {
    const { outstanding } = await outstandingInvoices(user, null, m.id);
    const pending = outstanding.reduce((s, x) => s + x.pending, 0);
    items.push({ label: "Pendiente de cobro", detail: outstanding.length ? `${formatMoney(pending)} (${outstanding.length} facturas)` : "Nada pendiente" });
  }
  await logRead(user, { matterId: m.id, kind: "ficha", detail: `${m.number} · consultado en el asistente` });
  return {
    text: `${m.number} · ${m.title} (abierto el ${formatDate(m.openedAt)}):`,
    items: [...items, { label: "Abrir el expediente", href: `/expedientes/${m.id}` }],
    suggestions: [`¿Cuánto debe ${m.client.split(" ")[0]}?`, "Plazos de esta semana"],
  };
}

async function clientInfo(user: CurrentUser, query: string): Promise<AssistantAnswer> {
  const digits = query.replace(/\D/g, "");
  const found = await db
    .select({ id: clients.id, name: clients.name, type: clients.type, idType: clients.idType, taxId: clients.taxId, email: clients.email, phone: clients.phone, birthDate: clients.birthDate })
    .from(clients)
    .where(and(or(ilike(clients.name, likePattern(query)), digits.length >= 4 ? ilike(clients.taxId, `%${digits}%`) : undefined), clientAccessSql(user, clients.id)))
    .orderBy(asc(clients.name))
    .limit(6);
  if (found.length === 0) return { text: `No encuentro ningún cliente «${query}» que puedas ver.` };
  if (found.length > 1) {
    return {
      text: `Hay ${found.length} clientes que coinciden:`,
      items: found.map((c) => ({ label: c.name, detail: formatId(c.idType, c.taxId) || undefined, href: `/clientes/${c.id}` })),
      suggestions: found.slice(0, 3).map((c) => `Cliente ${c.name}`),
    };
  }
  const c = found[0];
  const ms = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, status: matters.status })
    .from(matters)
    .where(and(eq(matters.clientId, c.id), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt))
    .limit(8);
  const active = ms.filter((m) => (ACTIVE as readonly string[]).includes(m.status));
  const items: AssistantItem[] = [
    ...(c.taxId ? [{ label: "Identificación", detail: formatId(c.idType, c.taxId) }] : []),
    ...(c.email || c.phone ? [{ label: "Contacto", detail: [c.email, c.phone].filter(Boolean).join(" · ") }] : []),
    { label: "Expedientes", detail: `${active.length} activos de ${ms.length}` },
    ...active.slice(0, 5).map((m) => ({ label: `${m.number} · ${m.title}`, detail: matterStatusLabels[m.status], href: `/expedientes/${m.id}` })),
  ];
  if (can(user, "facturacion.ver")) {
    const { outstanding } = await outstandingInvoices(user, c.id);
    const pending = outstanding.reduce((s, x) => s + x.pending, 0);
    items.push({ label: "Pendiente de cobro", detail: outstanding.length ? `${formatMoney(pending)} (${outstanding.length} facturas)` : "Nada pendiente" });
  }
  await logRead(user, { clientId: c.id, kind: "cliente", detail: `${c.name} · consultado en el asistente` });
  return { text: `${c.name}:`, items: [...items, { label: "Abrir la ficha del cliente", href: `/clientes/${c.id}` }] };
}

/** Facturas emitidas con saldo pendiente (opcionalmente de un cliente o de un expediente). */
async function outstandingInvoices(user: CurrentUser, clientId: number | null, matterId?: number) {
  const today = todayISO();
  const emitted = await db.query.invoices.findMany({
    where: and(
      eq(invoices.status, "emitida"),
      invoiceAccessSql(user),
      clientId !== null ? eq(invoices.clientId, clientId) : undefined,
      matterId !== undefined ? eq(invoices.matterId, matterId) : undefined,
    ),
    with: { items: true, payments: true, client: true },
    orderBy: asc(invoices.dueDate),
  });
  const adjustments = await loadAdjustments(db, emitted.filter((i) => i.kind === "factura").map((i) => i.id));
  const rows = emitted
    .map((inv) => ({ inv, s: summarizeInvoice(inv, today, adjustments.get(inv.id)) }))
    .filter((x) => x.s.outstandingCents > 0)
    .map((x) => ({ inv: x.inv, pending: x.s.outstandingCents, overdue: x.s.overdue }));
  return { outstanding: rows, overdue: rows.filter((r) => r.overdue) };
}

async function pendingInvoices(user: CurrentUser, clientQuery: string | null, onlyOverdue: boolean): Promise<AssistantAnswer> {
  if (!can(user, "facturacion.ver")) return { text: NO_BILLING };
  let clientId: number | null = null;
  let clientName = "";
  if (clientQuery) {
    const found = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(ilike(clients.name, likePattern(clientQuery)), clientAccessSql(user, clients.id)))
      .limit(5);
    if (found.length === 0) return { text: `No encuentro ningún cliente «${clientQuery}» que puedas ver.` };
    if (found.length > 1) return { text: "¿De qué cliente?", suggestions: found.map((c) => `¿Cuánto debe ${c.name}?`) };
    clientId = found[0].id;
    clientName = found[0].name;
  }
  const { outstanding, overdue } = await outstandingInvoices(user, clientId);
  const list = onlyOverdue ? overdue : outstanding;
  const total = list.reduce((s, x) => s + x.pending, 0);
  if (list.length === 0) {
    return { text: onlyOverdue ? "No hay facturas vencidas sin cobrar." : clientName ? `${clientName} no tiene nada pendiente de pago.` : "No hay facturas pendientes de cobro." };
  }
  const head = onlyOverdue
    ? `Hay ${list.length} ${list.length === 1 ? "factura vencida" : "facturas vencidas"} sin cobrar: ${formatMoney(total)}.`
    : clientName
      ? `${clientName} tiene ${formatMoney(total)} pendiente en ${list.length} ${list.length === 1 ? "factura" : "facturas"}.`
      : `Hay ${formatMoney(total)} pendiente de cobro en ${list.length} ${list.length === 1 ? "factura" : "facturas"}.`;
  return {
    text: head,
    items: list.slice(0, 8).map((x) => ({
      label: `${x.inv.number} · ${x.inv.client.name}`,
      detail: `${formatMoney(x.pending)} · vence el ${formatDate(x.inv.dueDate)}${x.overdue ? " (vencida)" : ""}`,
      href: `/facturas/${x.inv.id}`,
    })),
  };
}

async function deadlines(user: CurrentUser, days: number): Promise<AssistantAnswer> {
  const start = new Date(new Date().setHours(0, 0, 0, 0));
  const end = new Date(start.getTime() + days * 86_400_000);
  const rows = await db
    .select({ id: events.id, title: events.title, kind: events.kind, startsAt: events.startsAt, matterId: events.matterId, number: matters.number, assigned: users.name })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .where(and(eq(events.completed, false), gte(events.startsAt, start), lt(events.startsAt, end), matterAccessSql(user, events.matterId, { orNone: true })))
    .orderBy(asc(events.startsAt))
    .limit(12);
  const when = days === 1 ? "hoy" : days === 2 ? "hoy y mañana" : days > 7 ? "en los próximos 30 días" : "en los próximos 7 días";
  if (rows.length === 0) return { text: `No hay eventos ni plazos pendientes ${when}.`, suggestions: ["Plazos del mes"] };
  return {
    text: `${rows.length} ${rows.length === 1 ? "evento pendiente" : "eventos pendientes"} ${when}:`,
    items: rows.map((e) => ({
      label: `${eventKindLabels[e.kind]}: ${e.title}`,
      detail: [formatDateTime(e.startsAt), e.number, e.assigned].filter(Boolean).join(" · "),
      href: e.matterId ? `/expedientes/${e.matterId}?tab=agenda` : "/agenda",
    })),
  };
}

async function activeMatters(user: CurrentUser): Promise<AssistantAnswer> {
  const rows = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, status: matters.status, client: clients.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(and(inArray(matters.status, [...ACTIVE]), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt))
    .limit(10);
  if (rows.length === 0) return { text: "No hay expedientes activos que puedas ver." };
  return {
    text: `Expedientes activos (${rows.length === 10 ? "los 10 más recientes" : rows.length}):`,
    items: rows.map((m) => ({ label: `${m.number} · ${m.title}`, detail: `${m.client} · ${matterStatusLabels[m.status]}`, href: `/expedientes/${m.id}` })),
  };
}

/** Búsqueda libre: busca a la vez clientes y expedientes con ese texto. */
async function search(user: CurrentUser, query: string): Promise<AssistantAnswer> {
  const [cs, ms] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(and(ilike(clients.name, likePattern(query)), clientAccessSql(user, clients.id))).limit(4),
    db
      .select({ id: matters.id, number: matters.number, title: matters.title })
      .from(matters)
      .where(and(or(ilike(matters.title, likePattern(query)), ilike(matters.number, likePattern(query))), matterAccessSql(user, matters.id)))
      .limit(4),
  ]);
  if (cs.length === 1 && ms.length === 0) return clientInfo(user, cs[0].name);
  if (ms.length === 1 && cs.length === 0) return matterInfo(user, { kind: "expediente", ref: ms[0].number });
  if (cs.length + ms.length === 0) return { text: `No he entendido la pregunta ni encuentro «${query}» entre clientes y expedientes.`, suggestions: HELP_SUGGESTIONS };
  return {
    text: `Esto es lo que encuentro con «${query}»:`,
    items: [
      ...cs.map((c) => ({ label: c.name, detail: "Cliente", href: `/clientes/${c.id}` })),
      ...ms.map((m) => ({ label: `${m.number} · ${m.title}`, detail: "Expediente", href: `/expedientes/${m.id}` })),
    ],
  };
}

function formsList(): AssistantAnswer {
  return {
    text: "Formularios disponibles (escritos de abogado y escrituras notariales):",
    items: TEMPLATES.map((t) => ({ label: t.title, detail: t.kind === "escrito" ? `Escrito · ${t.category}` : `Escritura · ${t.category}`, href: `/formularios/${t.key}` })),
  };
}

/** Lleva al formulario pedido, ya enlazado al expediente si se indicó y la persona lo ve. */
async function generateLink(user: CurrentUser, templateKey: string | null, ref: string | null): Promise<AssistantAnswer> {
  const tpl = templateKey ? getTemplate(templateKey) : null;
  let matter: { id: number; number: string; title: string } | undefined;
  if (ref) {
    [matter] = await db.select({ id: matters.id, number: matters.number, title: matters.title }).from(matters).where(and(eq(matters.number, ref), matterAccessSql(user, matters.id))).limit(1);
    if (!matter) return { text: `No encuentro el expediente ${ref} (o no tienes acceso).`, suggestions: ["Expedientes activos"] };
  }
  if (!tpl) {
    return { text: "¿Qué quieres generar? Elige un formulario:", items: TEMPLATES.map((t) => ({ label: t.title, href: `/formularios/${t.key}${matter ? `?expediente=${matter.id}` : ""}` })) };
  }
  if (tpl.kind === "escrito" && !matter) {
    return { text: `Para generar «${tpl.title}» primero elige el expediente:`, items: [{ label: `Abrir «${tpl.title}» y elegir el expediente`, href: `/formularios/${tpl.key}` }], suggestions: ["Expedientes activos"] };
  }
  return {
    text: matter ? `Listo: «${tpl.title}» para ${matter.number} · ${matter.title}. Los datos del expediente y del cliente ya vienen rellenos.` : `Listo: «${tpl.title}».`,
    items: [{ label: tpl.kind === "escrito" ? "Generar escrito" : "Generar escritura", href: `/formularios/${tpl.key}${matter ? `?expediente=${matter.id}` : ""}` }],
  };
}

async function matterWritings(user: CurrentUser, ref: string | null): Promise<AssistantAnswer> {
  const rows = await db
    .select({ id: writings.id, title: writings.title, kind: writings.kind, updatedAt: writings.updatedAt, number: matters.number })
    .from(writings)
    .leftJoin(matters, eq(matters.id, writings.matterId))
    .where(and(writingAccessSql(user), ref ? eq(matters.number, ref) : undefined))
    .orderBy(desc(writings.updatedAt))
    .limit(10);
  if (rows.length === 0) return { text: ref ? `${ref} no tiene escritos (o no tienes acceso).` : "Aún no hay escritos.", suggestions: ["Formularios"] };
  return {
    text: ref ? `Escritos de ${ref}:` : "Últimos escritos:",
    items: rows.map((w) => ({ label: w.title, detail: `${w.kind === "escritura" ? "Escritura" : "Escrito"}${w.number ? ` · ${w.number}` : ""} · ${formatDateTime(w.updatedAt)}`, href: `/escritos/${w.id}` })),
  };
}

/* ---------- Conocimiento: base del despacho + leyes cargadas + cálculo de plazos ---------- */

const money = (n: number) => formatMoney(Math.round(n * 100));

/**
 * Responde una pregunta jurídica:
 *  1. Si es un trámite con plazo conocido (apelar, contestar…) y hay fecha, calcula el vencimiento.
 *  2. Escoge, en la base de conocimiento, el fragmento que mejor responde (y dice de dónde sale).
 *  3. Añade los artículos de las leyes cargadas que tratan el tema.
 * Con `quiet`, devuelve null si no encuentra nada (para seguir buscando en los datos del despacho).
 */
async function legalAnswer(user: CurrentUser, question: string, opts: { quiet?: true } = {}): Promise<AssistantAnswer | null> {
  const today = todayISO();
  const expanded = expandQuery(question);
  const proc = detectProcedure(question);
  const date = extractDate(question, today);
  const duration = extractDuration(question);
  const lines: string[] = [];
  const items: AssistantItem[] = [];

  if (date && (duration || proc)) {
    const amount = duration?.amount ?? proc!.days;
    const unit = duration?.unit ?? "dias";
    const d = procedureDeadline({ notified: date, amount, unit });
    lines.push(
      `${proc && !duration ? `Para ${proc.label} hay ${proc.days} días hábiles (${proc.ref}). ` : ""}Notificado el ${formatDate(date)}, el plazo de ${amount} ${unit === "dias" ? "días hábiles" : unit === "meses" ? (amount === 1 ? "mes" : "meses") : amount === 1 ? "año" : "años"} empieza a correr el ${formatDate(d.start)} y vence el ${formatDate(d.due)}.`,
    );
    const hol = d.skipped.map((x) => holidayName(x)).filter(Boolean);
    if (hol.length) lines.push(`Se saltan feriados: ${[...new Set(hol)].join(", ")}.`);
    lines.push("Regla: art. 30.5 del CPC (desde el día hábil siguiente; si vence en día inhábil, pasa al siguiente). No incluye cierres del Poder Judicial.");
    items.push({ label: "Abrir la calculadora de plazos", href: `/herramientas?calc=plazo&notificado=${date}&cantidad=${amount}&unidad=${unit}#plazo` });
  } else if (proc) {
    lines.push(`Para ${proc.label} el plazo es de ${proc.days} días hábiles (${proc.ref}), contados desde el día hábil siguiente a la notificación. Dime la fecha de notificación y te digo cuándo vence.`);
  }

  const [kb, arts] = await Promise.all([searchKnowledge(expanded, { limit: 4 }), searchArticles(expanded, { anyWords: true, limit: 4 })]);
  // En modo «quiet» (respaldo de otra intención) solo vale una coincidencia clara.
  const top = kb[0] && (!opts.quiet || kb[0].rank >= 0.5) ? kb[0] : undefined;
  if (opts.quiet && !top && !lines.length) return null;
  if (top && (!lines.length || top.rank > 0.05)) {
    if (!lines.length) lines.push(bestPassage(top.body, expanded));
    lines.push(`Fuente: «${top.title}» (base de conocimiento${top.reviewed ? "" : ", guía sin revisar"}).`);
    items.push({ label: `Ver «${top.title}»`, href: `/conocimiento?q=${encodeURIComponent(top.title)}#k${top.id}` });
    const loaded = await loadedLaws();
    for (const r of parseRefs(top.refs).filter((x) => loaded.has(x.normKey)).slice(0, 2))
      for (const a of r.articles.slice(0, 3)) items.push({ label: `Artículo ${a} · ${getNorm(r.normKey)?.name ?? r.normKey}`, href: `/normativa/${r.normKey}?art=${encodeURIComponent(a)}` });
  }
  for (const k of kb.slice(1, 3)) items.push({ label: k.title, detail: "Base de conocimiento", href: `/conocimiento?q=${encodeURIComponent(k.title)}#k${k.id}` });
  for (const a of arts.slice(0, lines.length ? 2 : 4))
    if (!items.some((i) => i.href === `/normativa/${a.normKey}?art=${encodeURIComponent(a.number)}`))
      items.push({ label: `Artículo ${a.number} · ${a.title}`, detail: a.snippet.replace(/\[\[|\]\]/g, "").slice(0, 140), href: `/normativa/${a.normKey}?art=${encodeURIComponent(a.number)}` });

  if (!lines.length && items.length) lines.push("Esto es lo que encontré sobre tu pregunta:");
  if (!lines.length) {
    if (opts.quiet) return null;
    return {
      text: "No encontré nada sobre eso en la base de conocimiento ni en las leyes cargadas. Si es algo que el despacho sabe, añádelo en Conocimiento y lo usaré a partir de ahora.",
      items: [{ label: "Añadir a la base de conocimiento", href: "/conocimiento/nueva" }],
    };
  }
  return { text: lines.join("\n"), items: items.slice(0, 7) };
}

/** «Calcula la cesantía de 3 años y 7 meses con salario de 600 000» → liquidación estimada. */
async function settlementAnswer(question: string): Promise<AssistantAnswer> {
  const e = extractSettlement(question);
  const tool = { label: "Abrir la calculadora de liquidación", href: "/herramientas?calc=liquidacion#liquidacion" };
  if (!e || !e.salary) return { text: "Para calcularlo necesito la antigüedad y el salario promedio mensual de los últimos seis meses. Por ejemplo: «liquidación de 3 años y 7 meses con salario de 600 000».", items: [tool] };
  const end = todayISO();
  const startD = new Date(`${end}T12:00:00Z`);
  startD.setUTCMonth(startD.getUTCMonth() - (e.years * 12 + e.months));
  const start = startD.toISOString().slice(0, 10);
  const r = laborSettlement({ start, end, avgMonthlySalary: e.salary, withoutJustCause: !e.justCause });
  const lines = [
    `Con ${e.years ? `${e.years} ${e.years === 1 ? "año" : "años"}` : ""}${e.years && e.months ? " y " : ""}${e.months ? `${e.months} ${e.months === 1 ? "mes" : "meses"}` : ""} y salario promedio de ${money(e.salary)} (${e.justCause ? "renuncia o justa causa" : "despido sin justa causa"}):`,
    ...r.lines.map((l) => `- ${l.concept}${l.days !== null ? ` (${String(l.days).replace(".", ",")} días)` : ""}: ${money(l.amount)}`),
    `Total estimado: ${money(r.total)}.`,
    ...r.lines.filter((l) => l.concept === "Auxilio de cesantía" || l.concept === "Preaviso").map((l) => l.basis),
    "Estimación orientativa (vacaciones y aguinaldo calculados con supuestos); ajústala en la calculadora.",
  ];
  return {
    text: lines.join("\n"),
    items: [
      { label: "Abrir en la calculadora", href: `/herramientas?calc=liquidacion&ingreso=${start}&salida=${end}&salario=${e.salary}&causa=${e.justCause ? "justa" : "sin"}#liquidacion` },
      { label: "Artículos 28 y 29 del Código de Trabajo", href: "/normativa/ley-2?q=28 y 29" },
    ],
  };
}

/** Normativa: del catálogo, o la citada en un expediente al que se tiene acceso. */
async function normativa(user: CurrentUser, query: string, ref: string | null, article: string | null = null): Promise<AssistantAnswer> {
  if (ref) {
    const [m] = await db.select({ id: matters.id }).from(matters).where(and(eq(matters.number, ref), matterAccessSql(user, matters.id)));
    if (!m) return { text: `No encuentro ${ref} (o no tienes acceso).` };
    const rows = await db.select().from(matterCitations).where(eq(matterCitations.matterId, m.id)).orderBy(asc(matterCitations.id));
    if (rows.length === 0) return { text: `${ref} aún no tiene normativa citada.`, items: [{ label: "Citar normas en el expediente", href: `/expedientes/${m.id}?tab=normativa` }] };
    return { text: `Fundamento de derecho de ${ref}:`, items: rows.map((c) => ({ label: citationText(c), href: `/expedientes/${m.id}?tab=normativa` })) };
  }
  const found = searchNorms(query).slice(0, 8);
  // «artículo 29 del código de trabajo»: si la ley está cargada, se responde con el texto.
  if (article && found.length) {
    const loaded = await loadedLaws();
    const norm = found.find((n) => loaded.has(n.key));
    if (norm) {
      const [a] = await articlesByNumber(loaded.get(norm.key)!.id, [article]);
      if (a) {
        const body = a.body.length > 700 ? `${a.body.slice(0, 700)}…` : a.body;
        return { text: `Artículo ${a.number} del ${norm.name}: ${body}`, items: [{ label: "Ver el artículo completo", href: `/normativa/${norm.key}?art=${encodeURIComponent(a.number)}` }] };
      }
      return { text: `No encuentro el artículo ${article} en el ${norm.name}.`, items: [{ label: `Abrir ${norm.name}`, href: `/normativa/${norm.key}` }] };
    }
  }
  // Una búsqueda por tema en los textos cargados («preaviso», «vacaciones»).
  if (!article && found.length === 0 && query) {
    const hits = await searchArticles(query, { limit: 6 });
    if (hits.length)
      return {
        text: `Artículos que tratan «${query}»:`,
        items: hits.map((h) => ({ label: `Artículo ${h.number} · ${h.title}`, detail: h.snippet.replace(/\[\[|\]\]/g, "").slice(0, 140), href: `/normativa/${h.normKey}?art=${encodeURIComponent(h.number)}` })),
      };
  }
  if (found.length === 0) return { text: `No tengo «${query}» en el catálogo. Búscalo en el SCIJ desde Normativa.`, items: [{ label: "Abrir Normativa", href: `/normativa?q=${encodeURIComponent(query)}` }] };
  return {
    text: query ? `Normativa sobre «${query}»:` : "Normativa costarricense del catálogo:",
    items: found.map((n) => ({ label: normLabel(n), detail: NORM_AREAS[n.area], href: `/normativa?q=${encodeURIComponent(n.number ?? n.name)}` })),
  };
}

/** Datos del protocolo PROPIO (nunca el de otro notario). */
async function notaryInfo(user: CurrentUser, what: "proxima" | "ultimas" | "indice" | "testimonios"): Promise<AssistantAnswer> {
  if (!can(user, "notaria.usar")) return { text: "No tienes acceso al gestor notarial." };
  const profile = await getNotaryProfile(user.id);
  if (!profile) return { text: "Aún no has configurado tu perfil de notario.", items: [{ label: "Completar perfil de notario", href: "/notaria/perfil" }] };
  if (what === "proxima") {
    return {
      text: `Tu próxima escritura es la número ${await nextDeedNumber(user.id)}.`,
      items: [{ label: "Tomo en uso", detail: profile.currentVolume ?? "Sin indicar" }, { label: "Folio por el que vas", detail: String(profile.nextFolio) }, { label: "Registrar escritura", href: "/notaria/escrituras/nueva" }],
    };
  }
  if (what === "indice") {
    const q = quincenaOf(todayISO());
    const [r] = await db.select({ n: count() }).from(deeds).where(and(eq(deeds.notaryId, user.id), gte(deeds.grantedOn, q.start), sql`${deeds.grantedOn} <= ${q.end}`));
    const pending = await pendingIndexes(user.id, todayISO());
    const text = `Índice de la quincena (${q.label}): ${r.n} ${r.n === 1 ? "escritura" : "escrituras"}.` +
      (pending.length
        ? ` Pendiente de presentar en INDEX: ${pending.map((p) => `${p.q.label}${"due" in p.state ? ` (${p.state.kind === "vencido" ? "venció" : "vence"} el ${formatDate(p.state.due)})` : ""}`).join("; ")}.`
        : " No hay índices pendientes de presentar en INDEX.");
    return {
      text,
      items: [
        ...pending.map((p) => ({ label: `Presentar ${p.q.label}`, href: `/notaria/indice?q=${p.q.key}` })),
        { label: "Ver e imprimir el índice", href: `/notaria/indice?q=${q.key}` },
      ],
    };
  }
  if (what === "testimonios") {
    const rows = await db
      .select({ ordinal: testimonies.ordinal, issuedOn: testimonies.issuedOn, deedId: deeds.id, number: deeds.number })
      .from(testimonies)
      .innerJoin(deeds, eq(deeds.id, testimonies.deedId))
      .where(eq(deeds.notaryId, user.id))
      .orderBy(desc(testimonies.issuedOn))
      .limit(8);
    if (!rows.length) return { text: "Aún no has registrado testimonios." };
    return { text: "Últimos testimonios expedidos:", items: rows.map((t) => ({ label: `${t.ordinal}.º testimonio · escritura ${t.number}`, detail: formatDate(t.issuedOn), href: `/notaria/escrituras/${t.deedId}` })) };
  }
  const rows = await db.select().from(deeds).where(eq(deeds.notaryId, user.id)).orderBy(desc(deeds.number)).limit(8);
  if (!rows.length) return { text: "Tu protocolo aún no tiene escrituras.", items: [{ label: "Registrar escritura", href: "/notaria/escrituras/nueva" }] };
  const pend = await db.select({ deedId: deedParties.deedId }).from(deedParties).where(and(inArray(deedParties.deedId, rows.map((d) => d.id)), isNull(deedParties.signedOn)));
  return {
    text: "Últimas escrituras de tu protocolo:",
    items: rows.map((d) => ({
      label: `N.º ${d.number} · ${d.act}`,
      detail: `${formatDate(d.grantedOn)}${d.status === "no_paso" ? " · no pasó" : ""}${pend.some((p) => p.deedId === d.id) ? " · faltan firmas" : ""}`,
      href: `/notaria/escrituras/${d.id}`,
    })),
  };
}
