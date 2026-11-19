import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { roles, sessions, users, type User } from "@/db/schema";
import { can, effectivePermissions, type Permission } from "./permissions";
import { hashSessionId, readSessionCookie } from "./session";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "hourlyRateCents" | "mustChangePassword" | "roleId"> & {
  roleName: string;
  /** Permisos efectivos de su rol (ver lib/permissions.ts). */
  permissions: Permission[];
};

/**
 * Usuario de la sesión actual. La sesión tiene que existir en la base de datos y no haber caducado
 * (cerrarla o revocarla la anula al instante) y el usuario tiene que estar activo.
 * Incluye a quien aún debe cambiar la contraseña: úsese solo en el login y en la pantalla de cambio.
 */
export const getSessionUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSessionCookie();
  if (!session) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleId: users.roleId,
      roleName: roles.name,
      roleSystemKey: roles.systemKey,
      rolePermissions: roles.permissions,
      hourlyRateCents: users.hourlyRateCents,
      mustChangePassword: users.mustChangePassword,
      active: users.active,
    })
    .from(users)
    .innerJoin(sessions, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.id, session.userId),
        eq(sessions.tokenHash, hashSessionId(session.sid)),
        gt(sessions.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  if (!row || !row.active) return null;
  const { active: _active, roleSystemKey, rolePermissions, ...current } = row;
  return { ...current, permissions: effectivePermissions({ systemKey: roleSystemKey, permissions: rolePermissions }) };
});

/**
 * Usuario que puede usar la aplicación: con sesión válida y SIN un cambio de contraseña pendiente.
 * Es lo que usan las rutas de /api: quien debe cambiar la contraseña recibe 401 hasta que lo haga.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
});

/** Para páginas y acciones: a /login sin sesión, y a cambiar la contraseña si la tiene pendiente. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/cambiar-contrasena");
  return user;
}

/** Para páginas y acciones que exigen un permiso: sin él, al panel con un aviso. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/?error=forbidden");
  return user;
}
