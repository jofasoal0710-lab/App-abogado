import "server-only";
import { sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { getSessionUser } from "./auth";

/**
 * Autoría en el registro de cambios y borrados (SEC-004, tabla data_audit).
 *
 * Los disparadores de PostgreSQL (migración 0022) registran cada borrado —con la fila completa— y cada
 * cambio, venga de donde venga. Para saber QUIÉN fue, la app fija `app.actor_id` dentro de la transacción
 * (set_config local: no se filtra a otras peticiones que reutilicen la conexión del pool).
 */
export async function setAuditActor(tx: Db, actorId: number): Promise<void> {
  await tx.execute(sql`select set_config('app.actor_id', ${String(actorId)}, true)`);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ejecuta `fn` en una transacción firmada por `actorId`: lo que borre o cambie queda a su nombre. */
export function asActor<T>(actorId: number, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await setAuditActor(tx, actorId);
    return fn(tx);
  });
}

/** Igual que setAuditActor, con la persona de la sesión actual (si la hay). */
export async function stampSessionActor(tx: Db): Promise<void> {
  const u = await getSessionUser().catch((err) => {
    console.error("[auditoría] no se pudo leer la sesión:", err);
    return null;
  });
  if (u) await setAuditActor(tx, u.id);
}

/** Ejecuta `fn` en una transacción firmada por la persona de la sesión actual. */
export function asSessionActor<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await stampSessionActor(tx);
    return fn(tx);
  });
}
