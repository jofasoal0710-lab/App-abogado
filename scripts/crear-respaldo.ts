/** Copia de seguridad manual a un fichero local: npm run db:backup -- [destino.json.gz] (SEC-001). */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { Pool } from "pg";
import { pgConfig } from "../src/db/connection";
import { dumpDatabase } from "../src/lib/backup-core";

async function main() {
  const out = process.argv[2] ?? `respaldo-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json.gz`;
  const pool = new Pool({ ...pgConfig(), connectionTimeoutMillis: 15_000 });
  const dump = await dumpDatabase((t, p) => pool.query(t, p as unknown[]));
  writeFileSync(out, gzipSync(Buffer.from(JSON.stringify(dump))));
  await pool.end();
  console.log(`✔ ${out}: ${Object.keys(dump.tables).length} tablas, ${dump.rows} filas.`);
}
main();
