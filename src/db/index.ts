import "../lib/timezone";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

const pool =
  globalForDb.__pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://abogado:abogado@localhost:5432/abogado",
    // En serverless cada instancia abre su propio pool: usa un valor bajo (p. ej. 3) y la URL con pooler.
    max: Number.isInteger(Number(process.env.DATABASE_POOL_MAX)) && Number(process.env.DATABASE_POOL_MAX) > 0 ? Number(process.env.DATABASE_POOL_MAX) : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });

// Reutiliza el pool entre recargas en desarrollo para no agotar conexiones.
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
