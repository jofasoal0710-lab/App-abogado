import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deeds, notaryIndexSubmissions, notaryProfiles } from "@/db/schema";
import { indexState, type IndexState } from "./notary-index";
import { quincena, quincenaOf, shiftQuincena, type Quincena } from "./notary-period";

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

/**
 * Índices de quincenas ya cerradas que faltan por presentar en INDEX (las 4 últimas, sin ir más atrás de
 * la primera escritura o presentación registrada en la aplicación). Incluye la recién cerrada aunque no
 * haya escrituras: el índice en blanco también se presenta. Vacío si el usuario no tiene perfil de notario.
 */
export async function pendingIndexes(notaryId: number, today: string): Promise<{ q: Quincena; state: IndexState }[]> {
  // Solo quien ejerce como notario (tiene perfil): el permiso lo tienen también abogados que no lo son.
  if (!(await getNotaryProfile(notaryId))) return [];
  const [[d], subs] = await Promise.all([
    db.select({ first: sql<string | null>`min(${deeds.grantedOn})::text` }).from(deeds).where(eq(deeds.notaryId, notaryId)),
    db.select({ p: notaryIndexSubmissions.period, on: notaryIndexSubmissions.submittedOn }).from(notaryIndexSubmissions).where(eq(notaryIndexSubmissions.notaryId, notaryId)),
  ]);
  const firstSub = subs.map((s) => s.on).sort()[0];
  const first = [d?.first, firstSub].filter((x): x is string => !!x).sort()[0] ?? null;
  const done = new Set(subs.map((s) => s.p));
  const out: { q: Quincena; state: IndexState }[] = [];
  let key = shiftQuincena(quincenaOf(today).key, -1);
  for (let i = 0; i < 4; i++, key = shiftQuincena(key, -1)) {
    const q = quincena(key)!;
    if (i > 0 && (!first || q.end < first)) break;
    if (done.has(key)) continue;
    const state = indexState(q, today, null);
    if (state.kind === "pendiente" || state.kind === "vencido") out.push({ q, state });
  }
  return out;
}
