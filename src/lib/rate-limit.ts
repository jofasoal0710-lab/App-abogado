import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

/** Intentos fallidos permitidos desde una misma IP contra un mismo correo en la ventana. */
export const MAX_PER_IP_EMAIL = 5;
/** Intentos fallidos contra un mismo correo desde cualquier IP (frena ataques que rotan de IP). */
export const MAX_PER_EMAIL = 15;
export const WINDOW_MINUTES = 15;

export const ipEmailKey = (ip: string, email: string) => `ip|${ip}|${email}`;
export const emailKey = (email: string) => `email|${email}`;

export async function isRateLimited(key: string, max: number): Promise<boolean> {
  const [row] = await db
    .select({ count: loginAttempts.count })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.resetAt, sql`now()`)))
    .limit(1);
  return !!row && row.count >= max;
}

/** Suma un fallo; si la ventana anterior ya expiró, empieza una nueva. Atómico (un solo INSERT … ON CONFLICT). */
export async function registerFailure(key: string): Promise<void> {
  await db.execute(sql`
    insert into "login_attempts" ("key", "count", "reset_at")
    values (${key}, 1, now() + make_interval(mins => ${WINDOW_MINUTES}))
    on conflict ("key") do update set
      "count" = case when "login_attempts"."reset_at" <= now() then 1 else "login_attempts"."count" + 1 end,
      "reset_at" = case when "login_attempts"."reset_at" <= now() then now() + make_interval(mins => ${WINDOW_MINUTES}) else "login_attempts"."reset_at" end`);
  // Limpieza ocasional de ventanas caducadas para que la tabla no crezca.
  if (Math.random() < 0.05) await db.delete(loginAttempts).where(lt(loginAttempts.resetAt, sql`now()`));
}

export async function clearFailures(key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
