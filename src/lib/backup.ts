import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { desc, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { backupRuns } from "@/db/schema";
import { dumpDatabase, type BackupDump } from "./backup-core";
import { deleteBackupObject, listBackupObjects, readBackupObject, saveBackupObject } from "./storage";

/**
 * Copias de seguridad automáticas (SEC-001). Una al día (la lanza el mantenimiento: planificador interno
 * o cron), guardada en el almacenamiento de documentos bajo «respaldos/», y se conservan BACKUP_KEEP (30).
 * Restaurar: scripts/restaurar-respaldo.ts (ver DEPLOY-RENDER.md, «Copias de seguridad»).
 */
export function backupKeep(): number {
  const n = Number(process.env.BACKUP_KEEP);
  return Number.isInteger(n) && n > 0 ? n : 30;
}

const BACKUP_EVERY_HOURS = 20;

export function backupKeyFor(d: Date): string {
  return `respaldos/respaldo-${d.toISOString().slice(0, 19).replace(/:/g, "-")}.json.gz`;
}

export async function createBackup(): Promise<{ key: string; bytes: number; rows: number }> {
  const started = new Date();
  try {
    const dump = await dumpDatabase((text, params) => pool.query(text, params as unknown[]));
    const data = gzipSync(Buffer.from(JSON.stringify(dump)));
    const key = backupKeyFor(started);
    await saveBackupObject(key, data);
    await db.insert(backupRuns).values({ storageKey: key, bytes: data.length, rows: dump.rows, ok: true });
    const keys = await listBackupObjects();
    for (const old of keys.slice(0, Math.max(0, keys.length - backupKeep()))) await deleteBackupObject(old);
    return { key, bytes: data.length, rows: dump.rows };
  } catch (err) {
    await db.insert(backupRuns).values({ ok: false, error: (err as Error).message.slice(0, 500) });
    throw err;
  }
}

/** Crea la copia del día si la última correcta tiene más de 20 horas. */
export async function runDailyBackup(): Promise<{ key: string; bytes: number; rows: number } | null> {
  if (process.env.BACKUPS_DISABLED === "true") return null;
  const [last] = await db.select({ at: backupRuns.at }).from(backupRuns).where(eq(backupRuns.ok, true)).orderBy(desc(backupRuns.at)).limit(1);
  if (last && Date.now() - last.at.getTime() < BACKUP_EVERY_HOURS * 3600_000) return null;
  return createBackup();
}

export async function readBackup(key: string): Promise<Buffer | null> {
  return readBackupObject(key);
}

export function parseBackup(gz: Buffer): BackupDump {
  return JSON.parse(gunzipSync(gz).toString("utf8")) as BackupDump;
}

export { listBackupObjects };
