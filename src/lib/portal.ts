import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { clients, portalLinks } from "@/db/schema";
import { PORTAL_COOKIE, hashPortalToken, looksLikePortalToken } from "./portal-core";

export type PortalSession = { linkId: number; clientId: number; clientName: string; label: string };

/** Enlace vigente (no revocado ni caducado) para un token en claro. */
export async function portalLinkForToken(token: string): Promise<PortalSession | null> {
  if (!looksLikePortalToken(token)) return null;
  const [row] = await db
    .select({ linkId: portalLinks.id, clientId: portalLinks.clientId, clientName: clients.name, label: portalLinks.label })
    .from(portalLinks)
    .innerJoin(clients, eq(clients.id, portalLinks.clientId))
    .where(and(eq(portalLinks.tokenHash, hashPortalToken(token)), isNull(portalLinks.revokedAt), gt(portalLinks.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/**
 * Sesión del portal a partir de su cookie. Se comprueba el enlace en CADA petición: revocarlo o que
 * caduque corta el acceso al instante. Nada de esto da acceso a la aplicación del despacho.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value ?? "";
  return token ? portalLinkForToken(token) : null;
}
