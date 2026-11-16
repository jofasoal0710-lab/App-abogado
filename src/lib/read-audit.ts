import "server-only";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, matters, readAudit } from "@/db/schema";

/** Mismo usuario + misma cosa dentro de esta ventana se registra una sola vez (evita ruido al recargar). */
export const READ_DEDUP_MS = 10 * 60 * 1000;

type Target = {
  matterId?: number | null;
  clientId?: number | null;
  kind: "ficha" | "documento" | "factura" | "cliente";
  detail: string;
};

/**
 * Registra una lectura SOLO si afecta a un expediente restringido/confidencial o a un cliente confidencial.
 * Las lecturas de lo abierto no se registran (sería ruido sin valor).
 */
export async function logRead(user: { id: number }, t: Target): Promise<boolean> {
  const matterId = t.matterId ?? null;
  const clientId = matterId === null ? (t.clientId ?? null) : null;

  let relevant = false;
  if (matterId !== null) {
    const [m] = await db.select({ v: matters.visibility }).from(matters).where(eq(matters.id, matterId)).limit(1);
    relevant = !!m && m.v !== "abierto";
  } else if (clientId !== null) {
    const [c] = await db.select({ v: clients.visibility }).from(clients).where(eq(clients.id, clientId)).limit(1);
    relevant = !!c && c.v === "confidencial";
  }
  if (!relevant) return false;

  const detail = t.detail.slice(0, 200);
  const [dup] = await db
    .select({ id: readAudit.id })
    .from(readAudit)
    .where(
      and(
        eq(readAudit.userId, user.id),
        eq(readAudit.kind, t.kind),
        eq(readAudit.detail, detail),
        matterId !== null ? eq(readAudit.matterId, matterId) : isNull(readAudit.matterId),
        clientId !== null ? eq(readAudit.clientId, clientId) : isNull(readAudit.clientId),
        gte(readAudit.createdAt, new Date(Date.now() - READ_DEDUP_MS)),
      ),
    )
    .limit(1);
  if (dup) return false;

  await db.insert(readAudit).values({ userId: user.id, matterId, clientId, kind: t.kind, detail });
  return true;
}

export const READ_VERBS = { ficha: "Abrió", documento: "Descargó", factura: "Abrió la factura", cliente: "Abrió el cliente" } as const;
