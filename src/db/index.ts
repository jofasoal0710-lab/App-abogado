import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://abogado:abogado@localhost:5432/abogado",
    max: 10,
  });

// Reutiliza el pool entre recargas en desarrollo para no agotar conexiones.
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
