import "server-only";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { roles, users, type Role } from "@/db/schema";
import { can, effectivePermissions } from "./permissions";

/** Roles con cuántas personas (activas o no) los tienen asignados. */
export async function listRolesWithCounts() {
  const all = await db.select().from(roles).orderBy(asc(roles.id));
  const counts = new Map(
    (await db.select({ roleId: users.roleId, n: count() }).from(users).groupBy(users.roleId)).map((r) => [r.roleId, r.n]),
  );
  return all.map((r) => ({ ...r, permissions: effectivePermissions(r), users: counts.get(r.id) ?? 0 }));
}

export async function getRole(id: number): Promise<Role | null> {
  const [r] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return r ?? null;
}

/** ¿Este rol permite gestionar el equipo? */
export function roleManagesTeam(role: Pick<Role, "systemKey" | "permissions">): boolean {
  return can({ permissions: effectivePermissions(role) }, "equipo.gestionar");
}

/**
 * Personas ACTIVAS que pueden gestionar el equipo, sin contar a `exceptUserId` ni a quienes tienen
 * el rol `exceptRoleId`. Sirve para no dejar nunca la aplicación sin nadie que la administre.
 */
export async function countOtherActiveManagers({ exceptUserId, exceptRoleId }: { exceptUserId?: number; exceptRoleId?: number }): Promise<number> {
  const rows = await db
    .select({ id: users.id, systemKey: roles.systemKey, permissions: roles.permissions })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(users.active, true), exceptUserId ? ne(users.id, exceptUserId) : undefined, exceptRoleId ? ne(roles.id, exceptRoleId) : undefined));
  return rows.filter(roleManagesTeam).length;
}
