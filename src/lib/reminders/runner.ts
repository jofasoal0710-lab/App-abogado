import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, pool } from "@/db";
import { events, matters, reminderLog, users } from "@/db/schema";
import { dayKey } from "../dates";
import { getReminderConfig, isSmtpConfigured, type ReminderConfig } from "./config";
import {
  MAX_ATTEMPTS,
  OVERDUE_WINDOW_DAYS,
  buildDigestEmail,
  daysUntilEvent,
  groupByRecipient,
  pickReminder,
  type DueItem,
  type Recipient,
} from "./logic";
import { describeMailError, sendMail } from "./mailer";

export type RunResult = {
  status: "ok" | "skipped" | "locked";
  reason?: string;
  /** Eventos pendientes examinados. */
  considered: number;
  /** Correos enviados (uno por destinatario). */
  emailsSent: number;
  /** Avisos individuales incluidos en esos correos. */
  remindersSent: number;
  emailsFailed: number;
  /** Avisos que tocaban pero no tienen a quién enviarse (sin asignado/responsable, inactivo o sin avisos). */
  withoutRecipient: number;
  errors: string[];
};

const emptyResult = (over: Partial<RunResult>): RunResult => ({
  status: "ok",
  considered: 0,
  emailsSent: 0,
  remindersSent: 0,
  emailsFailed: 0,
  withoutRecipient: 0,
  errors: [],
  ...over,
});

const LOCK_KEY = "reminders";

/**
 * Envía los recordatorios que toquen ahora. Es idempotente: se puede ejecutar tantas veces
 * como se quiera al día (cron externo, planificador interno, botón manual) y cada aviso
 * se envía una sola vez.
 */
export async function runReminders(opts: { now?: Date } = {}): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const cfg = getReminderConfig();
  if (!isSmtpConfigured(cfg)) {
    return emptyResult({ status: "skipped", reason: "El servidor SMTP no está configurado (SMTP_HOST y MAIL_FROM)." });
  }

  // Un solo ejecutor a la vez (varias réplicas, planificador + botón manual…).
  const lockClient = await pool.connect();
  try {
    const { rows } = await lockClient.query("select pg_try_advisory_lock(hashtext($1)) as ok", [LOCK_KEY]);
    if (!rows[0].ok) return emptyResult({ status: "locked", reason: "Ya hay otra ejecución en curso." });
    try {
      return await execute(cfg, now);
    } finally {
      await lockClient.query("select pg_advisory_unlock(hashtext($1))", [LOCK_KEY]);
    }
  } finally {
    lockClient.release();
  }
}

/** Selecciona los avisos que tocan ahora, sin enviar ni escribir nada. */
export async function collectDue(cfg: ReminderConfig, now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(startOfToday.getTime() - OVERDUE_WINDOW_DAYS * 86_400_000);
  const maxOffset = Math.max(0, ...cfg.offsets);
  const windowEnd = new Date(startOfToday.getTime() + (maxOffset + 2) * 86_400_000);

  const assigned = alias(users, "assigned");
  const responsible = alias(users, "responsible");
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      kind: events.kind,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      matterId: matters.id,
      matterNumber: matters.number,
      assignedId: assigned.id,
      assignedName: assigned.name,
      assignedEmail: assigned.email,
      assignedActive: assigned.active,
      assignedOptIn: assigned.emailReminders,
      responsibleId: responsible.id,
      responsibleName: responsible.name,
      responsibleEmail: responsible.email,
      responsibleActive: responsible.active,
      responsibleOptIn: responsible.emailReminders,
    })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(assigned, eq(assigned.id, events.assignedId))
    .leftJoin(responsible, eq(responsible.id, matters.responsibleId))
    .where(and(eq(events.completed, false), gte(events.startsAt, windowStart), lt(events.startsAt, windowEnd)));

  const due: { recipient: Recipient; item: DueItem }[] = [];
  let withoutRecipient = 0;
  if (rows.length === 0) return { considered: 0, due, withoutRecipient };

  const logs = await db
    .select()
    .from(reminderLog)
    .where(inArray(reminderLog.eventId, rows.map((r) => r.id)));
  const logsFor = (eventId: number, eventDate: string) => logs.filter((l) => l.eventId === eventId && l.eventDate === eventDate);

  for (const r of rows) {
    const eventDate = dayKey(r.startsAt);
    const existing = logsFor(r.id, eventDate);
    const days = daysUntilEvent(r.startsAt, now);
    const offset = pickReminder({
      daysUntil: days,
      kind: r.kind,
      completed: false,
      offsets: cfg.offsets,
      sentOffsets: existing.filter((l) => l.status === "enviado").map((l) => l.offsetDays),
    });
    if (offset === null) continue;

    const failed = existing.find((l) => l.offsetDays === offset && l.status === "error");
    if (failed && failed.attempts >= MAX_ATTEMPTS) continue; // se dio por perdido tras varios intentos

    // Destinatario: la persona asignada; si no hay, el responsable del expediente.
    const candidate =
      r.assignedId !== null
        ? { id: r.assignedId, name: r.assignedName!, email: r.assignedEmail!, active: r.assignedActive!, optIn: r.assignedOptIn! }
        : r.responsibleId !== null
          ? { id: r.responsibleId, name: r.responsibleName!, email: r.responsibleEmail!, active: r.responsibleActive!, optIn: r.responsibleOptIn! }
          : null;
    if (!candidate || !candidate.active || !candidate.optIn) {
      withoutRecipient++;
      continue;
    }

    due.push({
      recipient: { id: candidate.id, name: candidate.name, email: candidate.email },
      item: {
        eventId: r.id,
        title: r.title,
        kind: r.kind,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        location: r.location,
        matterId: r.matterId,
        matterNumber: r.matterNumber,
        daysUntil: days,
        offset,
        eventDate,
      },
    });
  }
  return { considered: rows.length, due, withoutRecipient };
}

async function execute(cfg: ReminderConfig, now: Date): Promise<RunResult> {
  const { considered, due, withoutRecipient } = await collectDue(cfg, now);
  const result = emptyResult({ considered, withoutRecipient });

  for (const group of groupByRecipient(due)) {
    const email = buildDigestEmail({
      recipientName: group.recipient.name,
      items: group.items,
      appUrl: cfg.appUrl,
      firmName: cfg.firmName,
    });
    try {
      await sendMail(cfg, { to: group.recipient.email, ...email });
      await record(group.items, group.recipient, "enviado", null, now);
      result.emailsSent++;
      result.remindersSent += group.items.length;
    } catch (err) {
      const message = describeMailError(err, cfg);
      await record(group.items, group.recipient, "error", message, now);
      result.emailsFailed++;
      result.errors.push(`${group.recipient.email}: ${message}`);
    }
  }
  return result;
}

/** Vista previa: qué se enviaría en la próxima ejecución (no envía ni registra nada). */
export async function previewReminders(now = new Date()) {
  const cfg = getReminderConfig();
  const { due, withoutRecipient } = await collectDue(cfg, now);
  return { groups: groupByRecipient(due), withoutRecipient };
}

async function record(
  items: DueItem[],
  recipient: Recipient,
  status: "enviado" | "error",
  error: string | null,
  now: Date,
) {
  await db
    .insert(reminderLog)
    .values(
      items.map((i) => ({
        eventId: i.eventId,
        eventDate: i.eventDate,
        offsetDays: i.offset,
        userId: recipient.id,
        email: recipient.email,
        status,
        error,
        sentAt: status === "enviado" ? now : null,
      })),
    )
    .onConflictDoUpdate({
      target: [reminderLog.eventId, reminderLog.eventDate, reminderLog.offsetDays],
      set: {
        status,
        error,
        email: recipient.email,
        userId: recipient.id,
        attempts: sql`${reminderLog.attempts} + 1`,
        sentAt: status === "enviado" ? now : null,
      },
    });
}
