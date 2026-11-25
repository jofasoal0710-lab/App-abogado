import "server-only";
import { TURNSTILE_FIELD, judgeSiteverify, plausibleToken, turnstileSiteKey, turnstileVerifyUrl, type TurnstileAction } from "./turnstile-core";

export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false; reason: string; unavailable?: boolean };

/**
 * Comprueba en el servidor el token de Turnstile que envió el formulario. Si Turnstile no está configurado,
 * deja pasar (skipped). Si Cloudflare no responde, devuelve `unavailable` para que cada formulario decida.
 */
export async function verifyTurnstile(formData: FormData, action: TurnstileAction, ip?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!turnstileSiteKey() || !secret) return { ok: true, skipped: true };
  const token = formData.get(TURNSTILE_FIELD);
  if (!plausibleToken(token)) return { ok: false, reason: "sin token" };
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local") body.set("remoteip", ip);
  try {
    const res = await fetch(turnstileVerifyUrl(), { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, unavailable: true };
    return judgeSiteverify(await res.json(), action);
  } catch (err) {
    console.error("[turnstile] Cloudflare no respondió:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "sin respuesta", unavailable: true };
  }
}

export { turnstileSiteKey };
