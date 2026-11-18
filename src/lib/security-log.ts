import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { clientIp } from "./client-ip";
import type { SecurityEventKind } from "./security-events";

/** Los eventos se conservan un año (protección de datos: lo justo para investigar un incidente). */
export const SECURITY_LOG_RETENTION_DAYS = 365;

export type EventData = {
  actorId?: number | null;
  targetId?: number | null;
  email?: string | null;
  ip?: string | null;
  detail?: string | null;
};

/** IP (según CLIENT_IP_HEADER; ver lib/client-ip.ts) y navegador de la petición actual. */
export async function requestMeta(): Promise<{ ip: string; userAgent: string | undefined }> {
  const h = await headers();
  return { ip: clientIp((name) => h.get(name)), userAgent: h.get("user-agent") ?? undefined };
}

/** Anota un evento. Nunca recibe contraseñas ni tokens: solo quién, a quién, desde dónde y qué. */
export async function logSecurityEvent(kind: SecurityEventKind, data: EventData = {}): Promise<void> {
  await db.insert(securityEvents).values({
    kind,
    actorId: data.actorId ?? null,
    targetId: data.targetId ?? null,
    email: data.email?.slice(0, 200) ?? null,
    ip: data.ip?.slice(0, 64) ?? null,
    detail: data.detail?.slice(0, 500) ?? null,
  });
  if (Math.random() < 0.01) {
    await db.delete(securityEvents).where(lt(securityEvents.at, sql`now() - make_interval(days => ${SECURITY_LOG_RETENTION_DAYS})`));
  }
}

/** ¿Hay ya un evento de este tipo para este correo en los últimos minutos? (evita inundar el registro). */
export async function loggedRecently(kind: SecurityEventKind, email: string, minutes: number): Promise<boolean> {
  const [row] = await db
    .select({ id: securityEvents.id })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.kind, kind),
        eq(securityEvents.email, email),
        gt(securityEvents.at, sql`now() - make_interval(mins => ${minutes})`),
      ),
    )
    .limit(1);
  return !!row;
}
