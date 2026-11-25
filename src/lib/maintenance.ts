import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { docTemplates, documents, intakeFiles, intakeRequests } from "@/db/schema";
import { INTAKE_DISCARDED_RETENTION_DAYS } from "./intake";
import { deleteFile, isAppKey, listStoredObjects, storageDriver } from "./storage";

/**
 * Mantenimiento periódico (lo lanzan el cron de recordatorios y el planificador interno).
 *
 * Subidas huérfanas (OWASP-A06-004): con almacenamiento S3 el navegador sube el fichero directamente
 * al bucket y después la app lo registra. Si el registro no llega (pestaña cerrada, red caída o alguien
 * que pide URLs sin registrarlas), el objeto queda en el bucket sin documento. Aquí se borran los que
 * lleven más de ORPHAN_UPLOAD_MINUTES (60 por defecto: la URL de subida caduca a los 10 min y el token
 * de registro a los 15). Solo se tocan claves creadas por la app; lo demás del bucket, nunca. Cuentan como
 * registradas las claves de `documents` y de `doc_templates` (plantillas Word).
 */
export type OrphanCleanup = { checked: number; candidates: number; deleted: number; aborted?: string };

function orphanMinutes(): number {
  const n = Number(process.env.ORPHAN_UPLOAD_MINUTES);
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

export async function cleanupOrphanUploads(olderThanMinutes = orphanMinutes()): Promise<OrphanCleanup> {
  if (storageDriver() !== "s3") return { checked: 0, candidates: 0, deleted: 0 };
  const cutoff = Date.now() - olderThanMinutes * 60_000;
  let appObjects = 0;
  const old: string[] = [];
  for await (const o of listStoredObjects()) {
    if (!isAppKey(o.key)) continue;
    appObjects++;
    if (o.lastModified.getTime() <= cutoff) old.push(o.key);
  }

  const registered = new Set<string>();
  for (let i = 0; i < old.length; i += 500) {
    const chunk = old.slice(i, i + 500);
    for (const r of await db.select({ k: documents.storageKey }).from(documents).where(inArray(documents.storageKey, chunk))) registered.add(r.k);
    // Las plantillas Word también viven en el bucket con claves de la app: nunca son «huérfanas».
    for (const r of await db.select({ k: docTemplates.storageKey }).from(docTemplates).where(inArray(docTemplates.storageKey, chunk))) registered.add(r.k);
    // Y los adjuntos de las solicitudes de nuevos clientes.
    for (const r of await db.select({ k: intakeFiles.storageKey }).from(intakeFiles).where(inArray(intakeFiles.storageKey, chunk))) registered.add(r.k);
  }
  const orphans = old.filter((k) => !registered.has(k));

  // Salvaguarda: si de pronto «sobra» mucho (p. ej. la app apunta a otra base de datos), no se borra nada.
  const limit = Math.max(20, Math.floor(appObjects * 0.1));
  if (orphans.length > limit) {
    const aborted = `${orphans.length} objetos sin documento de ${appObjects}: demasiados para ser subidas abandonadas; no se borra nada. Revisa que DATABASE_URL apunte a la base de datos correcta.`;
    console.error(`[mantenimiento] ${aborted}`);
    return { checked: appObjects, candidates: orphans.length, deleted: 0, aborted };
  }
  for (const k of orphans) await deleteFile(k);
  if (orphans.length) console.log(`[mantenimiento] borradas ${orphans.length} subida(s) huérfana(s) del bucket`);
  return { checked: appObjects, candidates: orphans.length, deleted: orphans.length };
}

const g = globalThis as unknown as { __lastMaintenance?: number };

/** Como mucho una vez cada MAINTENANCE_INTERVAL_MINUTES (60) por proceso. Devuelve null si aún no tocaba. */
export async function runMaintenance(): Promise<{ orphanUploads: OrphanCleanup; backup: string | null } | null> {
  const n = Number(process.env.MAINTENANCE_INTERVAL_MINUTES);
  const interval = (Number.isFinite(n) && n >= 0 ? n : 60) * 60_000;
  if (Date.now() - (g.__lastMaintenance ?? 0) < interval) return null;
  g.__lastMaintenance = Date.now();
  const orphanUploads = await cleanupOrphanUploads();
  // Conservación (Ley 8968: lo justo): registro de cambios un año, historial de copias 90 días.
  await db.execute(sql`delete from data_audit where at < now() - interval '365 days'`);
  await db.execute(sql`delete from backup_runs where at < now() - interval '90 days'`);
  await purgeDiscardedIntake();
  // Copia de seguridad diaria (SEC-001). Un fallo queda en backup_runs y se ve en /seguridad/respaldos.
  let backup: string | null = null;
  try {
    const { runDailyBackup } = await import("./backup");
    const r = await runDailyBackup();
    if (r) {
      backup = r.key;
      console.log(`[respaldo] copia creada: ${r.key} (${r.rows} filas, ${Math.round(r.bytes / 1024)} KB)`);
    }
  } catch (err) {
    console.error("[respaldo] error:", err);
  }
  return { orphanUploads, backup };
}

/** Solicitudes descartadas hace más de INTAKE_DISCARDED_RETENTION_DAYS: se borran con sus adjuntos. */
export async function purgeDiscardedIntake(): Promise<number> {
  const old = await db
    .select({ id: intakeRequests.id })
    .from(intakeRequests)
    .where(sql`${intakeRequests.status} = 'descartada' and coalesce(${intakeRequests.reviewedAt}, ${intakeRequests.createdAt}) < now() - make_interval(days => ${INTAKE_DISCARDED_RETENTION_DAYS})`)
    .limit(200);
  if (!old.length) return 0;
  const ids = old.map((o) => o.id);
  const files = await db.select({ k: intakeFiles.storageKey }).from(intakeFiles).where(inArray(intakeFiles.requestId, ids));
  await db.delete(intakeRequests).where(inArray(intakeRequests.id, ids));
  for (const f of files) await deleteFile(f.k).catch(() => undefined);
  return ids.length;
}
