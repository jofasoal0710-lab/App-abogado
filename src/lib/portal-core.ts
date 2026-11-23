/** Portal del cliente: utilidades puras (sin base de datos). */
import { createHash, randomBytes } from "node:crypto";

export const PORTAL_COOKIE = "portal_s";
/** La sesión del portal dura 12 horas; luego el cliente vuelve a abrir su enlace (si sigue vigente). */
export const PORTAL_SESSION_SECONDS = 12 * 3600;
export const PORTAL_LINK_MAX_DAYS = 90;

export const newPortalToken = () => randomBytes(32).toString("base64url");
export const hashPortalToken = (t: string) => createHash("sha256").update(t).digest("hex");
/** Un token válido tiene exactamente el formato que genera newPortalToken (43 caracteres base64url). */
export const looksLikePortalToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

/** Días de validez del enlace: entero entre 1 y 90 (30 si no se indica). */
export function linkDays(raw: string): number | null {
  if (raw.trim() === "") return 30;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= PORTAL_LINK_MAX_DAYS ? n : null;
}

export type PortalLinkState = { revokedAt: Date | null; expiresAt: Date };
export function linkStatus(l: PortalLinkState, now: Date): "activo" | "revocado" | "caducado" {
  if (l.revokedAt) return "revocado";
  return l.expiresAt.getTime() <= now.getTime() ? "caducado" : "activo";
}
