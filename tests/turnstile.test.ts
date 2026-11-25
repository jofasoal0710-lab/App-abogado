import { describe, expect, it } from "vitest";
import { buildCsp } from "../src/lib/csp";
import { judgeSiteverify, plausibleToken, turnstileSiteKey, turnstileVerifyUrl } from "../src/lib/turnstile-core";

describe("Turnstile", () => {
  it("solo se activa con las dos claves", () => {
    expect(turnstileSiteKey({})).toBeNull();
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: "1x00000000000000000000AA" })).toBeNull();
    expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET_KEY: "s" })).toBe("1x00000000000000000000AA");
  });
  it("URL de verificación de Cloudflare por defecto", () => {
    expect(turnstileVerifyUrl({})).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
  it("tokens: no vacíos y de tamaño razonable", () => {
    expect(plausibleToken("")).toBe(false);
    expect(plausibleToken("x".repeat(2049))).toBe(false);
    expect(plausibleToken(undefined)).toBe(false);
    expect(plausibleToken("XXXX.DUMMY.TOKEN.XXXX")).toBe(true);
  });
  it("la respuesta debe ser correcta y de la misma acción", () => {
    expect(judgeSiteverify({ success: true, action: "login" }, "login").ok).toBe(true);
    expect(judgeSiteverify({ success: true }, "solicitud").ok).toBe(true);
    expect(judgeSiteverify({ success: true, action: "login" }, "solicitud").ok).toBe(false);
    expect(judgeSiteverify({ success: false, "error-codes": ["timeout-or-duplicate"] }, "login")).toEqual({ ok: false, reason: "timeout-or-duplicate" });
  });
  it("CSP: permite el script y el marco de Cloudflare solo si está configurado", () => {
    const off = buildCsp("n", {});
    expect(off).not.toMatch(/challenges\.cloudflare\.com/);
    expect(off).toMatch(/frame-src 'self'(;|$)/);
    const on = buildCsp("n", { TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET_KEY: "b" });
    expect(on).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(on).toMatch(/frame-src 'self' https:\/\/challenges\.cloudflare\.com/);
  });
});
