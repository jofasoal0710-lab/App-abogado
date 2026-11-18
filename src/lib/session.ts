import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, lt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { SESSION_COOKIE, SESSION_HOURS, hashSessionId, signSession, verifySession, type SessionPayload } from "./session-token";

/**
 * Sesiones con estado en el servidor (OWASP-A07-001).
 *
 * La cookie lleva un JWT firmado con { userId, sid }, donde `sid` es un identificador aleatorio de 256 bits.
 * La sesión solo es válida si su fila sigue en la tabla `sessions` (se guarda el hash de `sid`, nunca el
 * valor). Cerrar sesión, cambiar la contraseña o desactivar a alguien borra filas y la cookie deja de
 * valer AL INSTANTE, aunque alguien la hubiera copiado. Duración máxima: una jornada.
 */
export { SESSION_COOKIE, SESSION_HOURS, hashSessionId, signSession, verifySession, type SessionPayload } from "./session-token";

/** Token de la cookie actual, ya verificado (sin consultar la base de datos). */
export async function readSessionCookie(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export async function createSession(userId: number, meta: { ip?: string; userAgent?: string } = {}): Promise<void> {
  const sid = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await db.insert(sessions).values({
    tokenHash: hashSessionId(sid),
    userId,
    expiresAt,
    ip: meta.ip?.slice(0, 64) ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  // Limpieza ocasional de sesiones caducadas para que la tabla no crezca.
  if (Math.random() < 0.05) await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ userId, sid }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/** Cierra la sesión actual de verdad: borra su fila (la cookie copiada deja de valer) y la cookie. */
export async function destroySession(): Promise<SessionPayload | null> {
  const current = await readSessionCookie();
  if (current) await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionId(current.sid)));
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return current;
}

/** Cierra todas las sesiones de un usuario, salvo (opcionalmente) la indicada. Devuelve cuántas cerró. */
export async function revokeSessions(userId: number, exceptSid?: string): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), exceptSid ? ne(sessions.tokenHash, hashSessionId(exceptSid)) : undefined))
    .returning({ id: sessions.id });
  return rows.length;
}
