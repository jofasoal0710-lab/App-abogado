import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { DEFAULT_DATABASE_URL, pgConfig } from "./connection";
import { describeDbTarget, explainDbError } from "./deploy-checks";

async function main() {
  const target = describeDbTarget(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  const pool = new Pool({ ...pgConfig(), connectionTimeoutMillis: 15_000 });
  pool.on("error", () => {});

  // Primero, solo conectar: así un fallo de conexión se explica por sí mismo (qué cambiar y dónde).
  try {
    await pool.query("select 1");
  } catch (err) {
    console.error(`\n✖ No se pudo conectar con la base de datos (${target}).\n  ${explainDbError(err)}\n  Detalle técnico: ${(err as Error).message}\n`);
    await pool.end().catch(() => {});
    process.exit(1);
  }
  console.log(`Conectado con la base de datos (${target}).`);

  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } catch (err) {
    console.error("\n✖ La conexión funciona, pero falló una migración. Pásale este mensaje a quien mantiene la app:\n", err);
    await pool.end().catch(() => {});
    process.exit(1);
  }
  await pool.end();
  console.log("Migraciones aplicadas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
