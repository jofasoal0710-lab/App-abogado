import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "hourlyRateCents">;

/** Usuario de la sesión actual, comprobado contra la base de datos (activo y existente). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      hourlyRateCents: users.hourlyRateCents,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || !user.active) return null;
  const { active: _active, ...current } = user;
  return current;
});

/** Para páginas: redirige a /login si no hay sesión. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Para páginas y acciones reservadas a administradores. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/?error=forbidden");
  return user;
}

/** Los asistentes no pueden emitir ni anular facturas. */
export function canManageInvoices(user: CurrentUser) {
  return user.role === "admin" || user.role === "abogado";
}
