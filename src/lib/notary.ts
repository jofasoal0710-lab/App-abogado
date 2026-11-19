import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deeds, notaryProfiles } from "@/db/schema";

/** Perfil de notario de un usuario (o null si aún no lo ha configurado). */
export async function getNotaryProfile(userId: number) {
  const [p] = await db.select().from(notaryProfiles).where(eq(notaryProfiles.userId, userId)).limit(1);
  return p ?? null;
}

/** Siguiente número de escritura del notario (correlativo). */
export async function nextDeedNumber(notaryId: number): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(max(${deeds.number}), 0)::int` }).from(deeds).where(eq(deeds.notaryId, notaryId));
  return (r?.n ?? 0) + 1;
}

/** Escritura del protocolo, SOLO si es del propio notario (el protocolo es personal y reservado). */
export async function getOwnDeed(notaryId: number, deedId: number) {
  const [d] = await db.select().from(deeds).where(and(eq(deeds.id, deedId), eq(deeds.notaryId, notaryId))).limit(1);
  return d ?? null;
}

export async function lastDeeds(notaryId: number, limit = 10) {
  return db.select().from(deeds).where(eq(deeds.notaryId, notaryId)).orderBy(desc(deeds.number)).limit(limit);
}
