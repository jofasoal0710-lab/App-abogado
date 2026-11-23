import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { events, matters, roles, users } from "@/db/schema";
import { matterAccessSql } from "./access";
import { effectivePermissions } from "./permissions";
import type { CalendarRow } from "./hearings";

/** Enlace privado de calendario: token aleatorio de 256 bits; en la base de datos solo se guarda su hash. */
export const hashCalendarToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newCalendarToken = () => randomBytes(32).toString("base64url");

export async function loadCalendarRows(where: SQL | undefined): Promise<CalendarRow[]> {
  return db
    .select({
      id: events.id,
      kind: events.kind,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      location: events.location,
      hearingType: events.hearingType,
      hearingMode: events.hearingMode,
      meetingUrl: events.meetingUrl,
      matterNumber: matters.number,
      court: matters.court,
      visibility: matters.visibility,
    })
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .where(where)
    .orderBy(asc(events.startsAt))
    .limit(2000);
}

/**
 * Suscripción: eventos asignados a la persona del token (pendientes, de 30 días atrás a un año), solo de
 * expedientes a los que sigue teniendo acceso. null si el token no existe o la cuenta está desactivada.
 */
export async function feedForToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, active: users.active, systemKey: roles.systemKey, permissions: roles.permissions })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.calendarTokenHash, hashCalendarToken(token)))
    .limit(1);
  if (!u || !u.active) return null;
  const who = { id: u.id, permissions: effectivePermissions({ systemKey: u.systemKey, permissions: u.permissions }) };
  const now = Date.now();
  const rows = await loadCalendarRows(
    and(eq(events.assignedId, u.id), eq(events.completed, false), gte(events.startsAt, new Date(now - 30 * 86_400_000)), lt(events.startsAt, new Date(now + 365 * 86_400_000)), matterAccessSql(who, events.matterId, { orNone: true })),
  );
  return { name: u.name, rows };
}
