/**
 * Cloudflare Turnstile (verificación anti-robots): configuración y lógica pura, sin red.
 *
 * Se activa poniendo en el entorno TURNSTILE_SITE_KEY (pública) y TURNSTILE_SECRET_KEY (secreta). Sin
 * ellas, todo funciona como antes (sin verificación). Claves de prueba de Cloudflare para desarrollo:
 * sitio 1x00000000000000000000AA y secreto 1x0000000000000000000000000000000AA (siempre pasa).
 */
type Env = Record<string, string | undefined>;

export const TURNSTILE_FIELD = "cf-turnstile-response";
export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const DEFAULT_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileAction = "login" | "solicitud";

export function turnstileSiteKey(env: Env = process.env): string | null {
  const k = env.TURNSTILE_SITE_KEY?.trim();
  return k && env.TURNSTILE_SECRET_KEY?.trim() ? k : null;
}

export function turnstileVerifyUrl(env: Env = process.env): string {
  // Solo para pruebas automáticas (un Cloudflare simulado en local). En producción no se define.
  return env.TURNSTILE_VERIFY_URL?.trim() || DEFAULT_VERIFY_URL;
}

/** Un token de Turnstile: texto no vacío de como mucho 2048 caracteres. */
export function plausibleToken(t: unknown): t is string {
  return typeof t === "string" && t.length > 0 && t.length <= 2048;
}

export type SiteverifyResponse = { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };

/** ¿La respuesta de Cloudflare vale para esta acción? (Un token del login no sirve para el formulario público.) */
export function judgeSiteverify(r: SiteverifyResponse, action: TurnstileAction): { ok: true } | { ok: false; reason: string } {
  if (!r.success) return { ok: false, reason: (r["error-codes"] ?? []).join(",") || "rechazado" };
  if (r.action && r.action !== action) return { ok: false, reason: `acción distinta (${r.action})` };
  return { ok: true };
}
