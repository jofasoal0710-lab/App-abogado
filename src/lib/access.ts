import "server-only";
import { and, asc, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { clients, documents, events, invoices, matterMembers, matterNotes, matters, roles, timeEntries, users, type Client, type Matter } from "@/db/schema";
import { can, effectivePermissions } from "./permissions";
import type { AccessUser } from "./access-rules";

/**
 * Fragmento SQL "el usuario puede ver el expediente cuyo id está en `matterIdCol`".
 * Es la traducción exacta de hasMatterAccess(). Nadie está exento: quien puede «ver restringidos» ve
 * los abiertos y restringidos, no los confidenciales (salvo que sea responsable o miembro).
 *
 * `orNone: true` deja pasar también las filas sin expediente (eventos sueltos).
 */
export function matterAccessSql(user: AccessUser, matterIdCol: SQLWrapper, opts: { orNone?: boolean } = {}): SQL {
  const adminSees = can(user, "expedientes.ver_restringidos") ? sql`or m_acc."visibility" = 'restringido'` : sql``;
  const allowed = sql`exists (
    select 1 from "matters" as m_acc
    where m_acc."id" = ${matterIdCol}
      and (
        m_acc."visibility" = 'abierto'
        ${adminSees}
        or m_acc."responsible_id" = ${user.id}
        or exists (select 1 from "matter_members" as mm_acc where mm_acc."matter_id" = m_acc."id" and mm_acc."user_id" = ${user.id})
      )
  )`;
  return opts.orNone ? sql`(${matterIdCol} is null or ${allowed})` : allowed;
}

/** Traducción SQL de hasClientAccess(): abierto, creado por mí, o con acceso a algún expediente suyo. */
export function clientAccessSql(user: AccessUser, clientIdCol: SQLWrapper): SQL {
  return sql`exists (
    select 1 from "clients" as c_acc
    where c_acc."id" = ${clientIdCol}
      and (
        c_acc."visibility" = 'abierto'
        or c_acc."created_by_id" = ${user.id}
        or exists (select 1 from "matters" as mc_acc where mc_acc."client_id" = c_acc."id" and ${matterAccessSql(user, sql`mc_acc."id"`)})
      )
  )`;
}

/**
 * Una factura con expediente sigue al expediente; una factura suelta (sin expediente) sigue al cliente,
 * para que la lista de facturas no delate un cliente confidencial.
 */
export function invoiceAccessSql(user: AccessUser): SQL {
  return sql`(
    (${invoices.matterId} is null and ${clientAccessSql(user, invoices.clientId)})
    or (${invoices.matterId} is not null and ${matterAccessSql(user, invoices.matterId)})
  )`;
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

/** Columnas para calcular los permisos de otro usuario (ver withPermissions). */
export const rolePermissionColumns = { roleSystemKey: roles.systemKey, rolePermissions: roles.permissions } as const;

/** Convierte una fila con rolePermissionColumns en un usuario con sus permisos efectivos. */
export function withPermissions<T extends { roleSystemKey: string | null; rolePermissions: string[] }>(row: T) {
  const { roleSystemKey, rolePermissions, ...rest } = row;
  return { ...rest, permissions: effectivePermissions({ systemKey: roleSystemKey, permissions: rolePermissions }) };
}

/** ¿Tiene acceso al expediente el usuario con este id? (p. ej. la persona a la que se asigna un evento). */
export async function canUserIdAccessMatter(userId: number, matterId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id, ...rolePermissionColumns })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.id, userId), eq(users.active, true)))
    .limit(1);
  return row ? (await getAccessibleMatter(withPermissions(row), matterId)) !== null : false;
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
  return exists(db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.id, invoiceId), invoiceAccessSql(user))).limit(1));
}

/** Cliente si existe Y el usuario puede verlo; null en cualquier otro caso. */
export async function getAccessibleClient(user: AccessUser, clientId: number): Promise<Client | null> {
  const [c] = await db.select().from(clients).where(and(eq(clients.id, clientId), clientAccessSql(user, clients.id))).limit(1);
  return c ?? null;
}

/** Para páginas: 404 si no existe o no hay acceso. */
export async function requireClientPage(user: AccessUser, clientId: number): Promise<Client> {
  const c = await getAccessibleClient(user, clientId);
  if (!c) notFound();
  return c;
}

/** Personas que se pueden añadir a un expediente: activas y que no sean ya responsable ni miembros (también quien tiene permisos amplios: en un confidencial nadie tiene acceso por rol). */
export async function listAddableUsers(matterId: number, responsibleId: number | null) {
  const members = await db.select({ userId: matterMembers.userId }).from(matterMembers).where(eq(matterMembers.matterId, matterId));
  const taken = new Set([...members.map((m) => m.userId), ...(responsibleId ? [responsibleId] : [])]);
  const all = await db
    .select({ id: users.id, name: users.name, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
  return all.filter((u) => !taken.has(u.id));
}

/** Responsable y miembros de un expediente, con su estado de activación. */
export async function getHolders(matterId: number) {
  const [m] = await db.select({ responsibleId: matters.responsibleId }).from(matters).where(eq(matters.id, matterId)).limit(1);
  const [responsible] = m?.responsibleId
    ? await db.select({ id: users.id, active: users.active }).from(users).where(eq(users.id, m.responsibleId)).limit(1)
    : [];
  const members = await db
    .select({ id: users.id, active: users.active })
    .from(matterMembers)
    .innerJoin(users, eq(users.id, matterMembers.userId))
    .where(eq(matterMembers.matterId, matterId));
  return { responsible: responsible ?? null, members };
}

/** Expedientes confidenciales de los que este usuario es el ÚNICO titular activo (desactivarlo los dejaría huérfanos). */
export async function countSoleHolderConfidential(userId: number): Promise<number> {
  const r = await db.execute(sql`
    select count(*)::int as n from "matters" m
    where m."visibility" = 'confidencial'
      and (m."responsible_id" = ${userId} or exists (select 1 from "matter_members" x where x."matter_id" = m."id" and x."user_id" = ${userId}))
      and not exists (
        select 1 from "users" u
        where u."active" and u."id" <> ${userId}
          and (u."id" = m."responsible_id" or exists (select 1 from "matter_members" y where y."matter_id" = m."id" and y."user_id" = u."id"))
      )`);
  return Number((r.rows[0] as { n: number }).n);
}

/** Expedientes confidenciales sin ninguna persona activa con acceso: nadie puede verlos ni gestionarlos. */
export async function listOrphanConfidentialMatters(): Promise<{ id: number; number: string; title: string }[]> {
  const r = await db.execute(sql`
    select m."id", m."number", m."title" from "matters" m
    where m."visibility" = 'confidencial'
      and not exists (
        select 1 from "users" u
        where u."active" and (u."id" = m."responsible_id" or exists (select 1 from "matter_members" y where y."matter_id" = m."id" and y."user_id" = u."id"))
      )
    order by m."number"`);
  return r.rows as { id: number; number: string; title: string }[];
}
