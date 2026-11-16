import "../lib/timezone";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { pgConfig } from "./connection";

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function createPool(): Pool {
  const p = new Pool({
    ...pgConfig(),
    // En serverless cada instancia abre su propio pool: usa un valor bajo (p. ej. 3) y la URL con pooler.
    max: Number.isInteger(Number(process.env.DATABASE_POOL_MAX)) && Number(process.env.DATABASE_POOL_MAX) > 0 ? Number(process.env.DATABASE_POOL_MAX) : 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  // Sin este manejador, el corte de una conexión INACTIVA (reinicio o suspensión del proveedor,
  // p. ej. Neon o Supabase) emite un 'error' sin escuchar y tumba el proceso. Con él, el pool
  // descarta esa conexión y abre otra en la siguiente consulta.
  p.on("error", (err) => console.error("[db] Conexión inactiva cerrada por el servidor; se abrirá otra:", err.message));
  return p;
}

const pool = globalForDb.__pgPool ?? createPool();

// Reutiliza el pool entre recargas en desarrollo para no agotar conexiones.
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
