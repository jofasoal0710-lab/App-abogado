import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { pgConfig } from "./connection";

async function main() {
  const pool = new Pool(pgConfig());
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migraciones aplicadas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
