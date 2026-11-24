import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, matters, users } from "@/db/schema";
import { appLocale } from "./locale";
import { getReminderConfig, isSmtpConfigured } from "./reminders/config";
import { escapeHtml } from "./reminders/logic";
import { describeMailError, sendMail } from "./reminders/mailer";
import { TASK_PRIORITIES } from "./tasks";

/**
 * Aviso por correo a quien le asignan una tarea (o un plazo, audiencia o reunión) otra persona. Solo si hay
 * SMTP, la persona está activa y no desactivó los avisos por correo. Nunca bloquea la acción: si falla, se anota.
 */
export async function notifyTaskAssigned(eventId: number, byUser: { id: number; name: string }): Promise<boolean> {
  const c = getReminderConfig();
  if (!isSmtpConfigured(c)) return false;
  const [row] = await db
    .select({ title: events.title, kind: events.kind, startsAt: events.startsAt, priority: events.priority, assignedId: events.assignedId, email: users.email, name: users.name, active: users.active, wants: users.emailReminders, matterId: events.matterId })
    .from(events)
    .innerJoin(users, eq(users.id, events.assignedId))
    .where(eq(events.id, eventId));
  if (!row || row.assignedId === byUser.id || !row.active || !row.wants) return false;
  const [m] = row.matterId ? await db.select({ number: matters.number }).from(matters).where(eq(matters.id, row.matterId)) : [];
  const when = row.startsAt.toLocaleString(appLocale(), { dateStyle: "full", timeStyle: "short" });
  const url = `${c.appUrl}/tareas`;
  const what = row.kind === "tarea" ? "una tarea" : row.kind === "plazo" ? "un plazo" : row.kind === "audiencia" ? "una audiencia" : "una reunión";
  // El título puede ser confidencial: el correo va solo al asignado, y nunca incluye notas del expediente.
  const text = `Hola ${row.name}:\n\n${byUser.name} te ha asignado ${what}: «${row.title}»${m ? ` (${m.number})` : ""}.\nFecha: ${when}. Prioridad: ${TASK_PRIORITIES[row.priority]}.\n\n${url}\n`;
  const html = `<p>Hola ${escapeHtml(row.name)}:</p><p>${escapeHtml(byUser.name)} te ha asignado ${what}: <strong>${escapeHtml(row.title)}</strong>${m ? ` (${escapeHtml(m.number)})` : ""}.</p><p>Fecha: ${escapeHtml(when)}. Prioridad: ${escapeHtml(TASK_PRIORITIES[row.priority])}.</p><p><a href="${escapeHtml(url)}">Ver mis tareas</a></p>`;
  try {
    await sendMail(c, { to: row.email, subject: `${c.firmName}: te han asignado ${what}`, text, html });
    return true;
  } catch (err) {
    console.error("[tareas] No se pudo enviar el aviso de asignación:", describeMailError(err, c));
    return false;
  }
}
