import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, type Db } from "@/db";
import { events, matterMembers, matters, roles, users } from "@/db/schema";
import { rolePermissionColumns, withPermissions } from "./access";
import { logAccessChange } from "./access-log";
import { hasMatterAccess } from "./access-rules";

/**
 * Tras un cambio de acceso, los eventos PENDIENTES asignados a quien ya no puede ver el expediente
 * pasan al responsable (que siempre tiene acceso) o quedan sin asignar si no hay responsable.
 * Se anota en el historial del expediente. Devuelve cuántos eventos se reasignaron.
 */
export async function reassignLostAccessEvents(matterId: number, actorId: number, dbx: Db = db): Promise<number> {
  const [matter] = await dbx.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) return 0;
  const memberIds = (await dbx.select({ id: matterMembers.userId }).from(matterMembers).where(eq(matterMembers.matterId, matterId))).map((m) => m.id);

  const pending = await db
    .select({ id: events.id, assignedId: events.assignedId, name: users.name, ...rolePermissionColumns })
    .from(events)
    .innerJoin(users, eq(users.id, events.assignedId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(events.matterId, matterId), eq(events.completed, false), isNotNull(events.assignedId)));

  const lost = pending.filter((e) => !hasMatterAccess({ ...withPermissions(e), id: e.assignedId! }, matter, memberIds));
  if (lost.length === 0) return 0;

  await dbx.update(events).set({ assignedId: matter.responsibleId }).where(inArray(events.id, lost.map((e) => e.id)));

  const [resp] = matter.responsibleId ? await dbx.select({ name: users.name }).from(users).where(eq(users.id, matter.responsibleId)) : [];
  const names = [...new Set(lost.map((e) => e.name))].join(", ");
  await logAccessChange(
    matterId,
    actorId,
    "reasignacion",
    `${lost.length} evento(s) pendiente(s) reasignado(s) a ${resp?.name ?? "nadie (sin responsable)"} por pérdida de acceso de: ${names}`,
    dbx,
  );
  return lost.length;
}
