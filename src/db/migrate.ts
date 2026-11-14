import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://abogado:abogado@localhost:5432/abogado",
  });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migraciones aplicadas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
