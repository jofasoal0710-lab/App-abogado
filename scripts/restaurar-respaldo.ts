/**
 * Restaura una copia de seguridad de la app (SEC-001).
 *
 *   npm run db:restore -- respaldo-2026-11-23T08-00-00.json.gz            (base de datos vacía)
 *   npm run db:restore -- respaldo-2026-11-23T08-00-00.json.gz --reemplazar  (SUSTITUYE todo el contenido)
 *
 * Usa DATABASE_URL (y DATABASE_SSL_CA si hace falta). Antes, aplica las migraciones: npm run db:migrate.
 * Todo ocurre en una transacción: si algo falla, la base de datos queda como estaba.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Pool } from "pg";
import { pgConfig } from "../src/db/connection";
import { restoreDatabase, type BackupDump } from "../src/lib/backup-core";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const replace = args.includes("--reemplazar");
  if (!file) {
    console.error("Uso: npm run db:restore -- <fichero .json.gz> [--reemplazar]");
    process.exit(2);
  }
  const raw = readFileSync(file);
  const dump = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")) as BackupDump;
  console.log(`Copia del ${dump.createdAt}: ${Object.keys(dump.tables).length} tablas, ${dump.rows} filas.`);

  const pool = new Pool({ ...pgConfig(), connectionTimeoutMillis: 15_000 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const r = await restoreDatabase((t, p) => client.query(t, p as unknown[]), dump, { replace });
    await client.query("commit");
    console.log(`✔ Restauradas ${r.rows} filas en ${r.tables} tablas.`);
  } catch (err) {
    await client.query("rollback").catch(() => {});
    console.error(`✖ No se restauró nada: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
