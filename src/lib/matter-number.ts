import "server-only";
import { desc, like, sql } from "drizzle-orm";
import type { db } from "@/db";
import { matters } from "@/db/schema";
import { formatNumber, nextSequence } from "./numbering";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Siguiente número de expediente (EXP-2026-0001…). Llamar dentro de la transacción del alta: la bloquea. */
export async function nextMatterNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = "EXP";
  // Bloqueo por transacción: dos altas simultáneas no pueden obtener el mismo número.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('matter_number'))`);
  const [last] = await tx
    .select({ number: matters.number })
    .from(matters)
    .where(like(matters.number, `${prefix}-${year}-%`))
    .orderBy(desc(matters.number))
    .limit(1);
  return formatNumber(prefix, year, nextSequence(last?.number, prefix, year));
}
