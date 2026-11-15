import "server-only";
import { and, asc, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { documents, events, invoices, matterMembers, matterNotes, matters, timeEntries, users, type Matter } from "@/db/schema";
import type { AccessUser } from "./access-rules";

/**
 * Fragmento SQL "el usuario puede ver el expediente cuyo id está en `matterIdCol`".
 * Es la traducción exacta de hasMatterAccess() y sirve en cualquier consulta (con o sin joins).
 * Devuelve undefined para administradores (sin restricción), así que se puede pasar a and(...).
 *
 * `orNone: true` deja pasar también las filas sin expediente (eventos y facturas sueltos).
 */
export function matterAccessSql(
  user: AccessUser,
  matterIdCol: SQLWrapper,
  opts: { orNone?: boolean } = {},
): SQL | undefined {
  if (user.role === "admin") return undefined;
  const allowed = sql`exists (
    select 1 from "matters" as m_acc
    where m_acc."id" = ${matterIdCol}
      and (
        m_acc."visibility" = 'abierto'
        or m_acc."responsible_id" = ${user.id}
        or exists (select 1 from "matter_members" as mm_acc where mm_acc."matter_id" = m_acc."id" and mm_acc."user_id" = ${user.id})
      )
  )`;
  return opts.orNone ? sql`(${matterIdCol} is null or ${allowed})` : allowed;
}

/** Expediente si existe Y el usuario tiene acceso; null en cualquier otro caso (no se distingue). */
export async function getAccessibleMatter(user: AccessUser, matterId: number): Promise<Matter | null> {
  const [m] = await db
    .select()
    .from(matters)
    .where(and(eq(matters.id, matterId), matterAccessSql(user, matters.id)))
    .limit(1);
  return m ?? null;
}

/** Para páginas: 404 (no 403) si no existe o no hay acceso, para no revelar que existe. */
export async function requireMatterPage(user: AccessUser, matterId: number): Promise<Matter> {
  const m = await getAccessibleMatter(user, matterId);
  if (!m) notFound();
  return m;
}

/** ¿Tiene acceso al expediente el usuario con este id? (p. ej. la persona a la que se asigna un evento). */
export async function canUserIdAccessMatter(userId: number, matterId: number): Promise<boolean> {
  const [u] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, userId), eq(users.active, true))).limit(1);
  return u ? (await getAccessibleMatter(u, matterId)) !== null : false;
}

/** Acceso a un expediente que puede ser null (evento o factura sin expediente → siempre permitido). */
export async function canAccessMatterOrNone(user: AccessUser, matterId: number | null): Promise<boolean> {
  return matterId === null ? true : (await getAccessibleMatter(user, matterId)) !== null;
}

/* ---- Comprobaciones por recurso: existe Y se puede ver. Falso también si no existe. ---- */

async function exists(query: Promise<{ id: number }[]>): Promise<boolean> {
  return (await query).length > 0;
}

export function canAccessEvent(user: AccessUser, eventId: number) {
  return exists(
    db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), matterAccessSql(user, events.matterId, { orNone: true }))).limit(1),
  );
}

export function canAccessDocument(user: AccessUser, documentId: number) {
  return exists(
    db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, documentId), matterAccessSql(user, documents.matterId))).limit(1),
  );
}

export function canAccessTimeEntry(user: AccessUser, entryId: number) {
  return exists(
    db.select({ id: timeEntries.id }).from(timeEntries).where(and(eq(timeEntries.id, entryId), matterAccessSql(user, timeEntries.matterId))).limit(1),
  );
}

export function canAccessNote(user: AccessUser, noteId: number) {
  return exists(
    db.select({ id: matterNotes.id }).from(matterNotes).where(and(eq(matterNotes.id, noteId), matterAccessSql(user, matterNotes.matterId))).limit(1),
  );
}

export function canAccessInvoice(user: AccessUser, invoiceId: number) {
  return exists(
    db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.id, invoiceId), matterAccessSql(user, invoices.matterId, { orNone: true }))).limit(1),
  );
}

/** Personas que se pueden añadir a un expediente: activas, no administradoras (ya lo ven todo), ni responsable ni miembros. */
export async function listAddableUsers(matterId: number, responsibleId: number | null) {
  const members = await db.select({ userId: matterMembers.userId }).from(matterMembers).where(eq(matterMembers.matterId, matterId));
  const taken = new Set([...members.map((m) => m.userId), ...(responsibleId ? [responsibleId] : [])]);
  const all = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
  return all.filter((u) => u.role !== "admin" && !taken.has(u.id));
}
