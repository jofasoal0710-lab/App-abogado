import { afterEach, describe, expect, it } from "vitest";
import { clientIp, isClientIpTrusted } from "../src/lib/client-ip";
import { getReminderConfig } from "../src/lib/reminders/config";

const headers = (h: Record<string, string>) => (name: string) => h[name];

describe("clientIp", () => {
  it("sin configuración usa el primer valor de x-forwarded-for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), {})).toBe("1.2.3.4");
  });
  it("sin ninguna cabecera, «local»", () => {
    expect(clientIp(headers({}), {})).toBe("local");
  });
  it("NO se fía de una cabecera de otra plataforma si no está configurada", () => {
    // Un atacante en Render puede enviar x-nf-client-connection-ip con el valor que quiera.
    expect(clientIp(headers({ "x-nf-client-connection-ip": "9.9.9.9" }), {})).toBe("local");
    expect(clientIp(headers({ "x-nf-client-connection-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }), {})).toBe("1.2.3.4");
  });
  it("usa la cabecera configurada con CLIENT_IP_HEADER (sin distinguir mayúsculas)", () => {
    const env = { CLIENT_IP_HEADER: "CF-Connecting-IP" };
    expect(clientIp(headers({ "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }), env)).toBe("5.6.7.8");
  });
  it("si la cabecera configurada no llega, vuelve a x-forwarded-for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4" }), { CLIENT_IP_HEADER: "cf-connecting-ip" })).toBe("1.2.3.4");
  });
  it("en Netlify (NETLIFY=true) usa su cabecera", () => {
    expect(clientIp(headers({ "x-nf-client-connection-ip": "7.7.7.7", "x-forwarded-for": "1.2.3.4" }), { NETLIFY: "true" })).toBe("7.7.7.7");
  });
  it("acota la longitud para no crear claves enormes", () => {
    expect(clientIp(headers({ "x-forwarded-for": "a".repeat(500) }), {}).length).toBe(64);
  });
});

describe("URL pública de la aplicación", () => {
  const saved = { app: process.env.APP_URL, render: process.env.RENDER_EXTERNAL_URL };
  afterEach(() => {
    for (const [k, v] of [["APP_URL", saved.app], ["RENDER_EXTERNAL_URL", saved.render]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("APP_URL tiene prioridad", () => {
    process.env.APP_URL = "https://app.midominio.es/";
    process.env.RENDER_EXTERNAL_URL = "https://x.onrender.com";
    expect(getReminderConfig().appUrl).toBe("https://app.midominio.es");
  });
  it("sin APP_URL usa la URL que asigna Render", () => {
    delete process.env.APP_URL;
    process.env.RENDER_EXTERNAL_URL = "https://app-abogado.onrender.com";
    expect(getReminderConfig().appUrl).toBe("https://app-abogado.onrender.com");
  });
  it("sin ninguna, localhost", () => {
    delete process.env.APP_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    expect(getReminderConfig().appUrl).toBe("http://localhost:3000");
  });
});

describe("SMTP: cifrado exigido por defecto (OWASP-A04-002)", () => {
  const saved = process.env.SMTP_REQUIRE_TLS;
  afterEach(() => {
    if (saved === undefined) delete process.env.SMTP_REQUIRE_TLS;
    else process.env.SMTP_REQUIRE_TLS = saved;
  });
  it("sin la variable, STARTTLS es obligatorio", () => {
    delete process.env.SMTP_REQUIRE_TLS;
    expect(getReminderConfig().smtp.requireTls).toBe(true);
  });
  it("solo «false» lo hace opcional (cualquier otro valor lo deja obligatorio)", () => {
    process.env.SMTP_REQUIRE_TLS = "false";
    expect(getReminderConfig().smtp.requireTls).toBe(false);
    process.env.SMTP_REQUIRE_TLS = "no";
    expect(getReminderConfig().smtp.requireTls).toBe(true);
  });
});

describe("isClientIpTrusted (OWASP-A07-002)", () => {
  it("solo con CLIENT_IP_HEADER configurada o en Netlify se bloquea por IP entre cuentas", () => {
    expect(isClientIpTrusted({})).toBe(false);
    expect(isClientIpTrusted({ CLIENT_IP_HEADER: "  " })).toBe(false);
    expect(isClientIpTrusted({ CLIENT_IP_HEADER: "true-client-ip" })).toBe(true);
    expect(isClientIpTrusted({ NETLIFY: "true" })).toBe(true);
  });
});

describe("CSP (OWASP-A02-001)", () => {
  it("scripts solo con el nonce de la respuesta; sin unsafe-inline ni unsafe-eval en producción", async () => {
    const { buildCsp } = await import("../src/lib/csp");
    const csp = buildCsp("NONCE123", { NODE_ENV: "production" });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-NONCE123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) expect(csp).toContain(d);
  });
  it("permite subir directamente al bucket S3 configurado (y a Hacienda para la consulta de cédulas; a nada más)", async () => {
    const { buildCsp, s3Origins } = await import("../src/lib/csp");
    expect(s3Origins({ STORAGE_DRIVER: "local", S3_ENDPOINT: "https://x.example" })).toEqual([]);
    expect(s3Origins({ STORAGE_DRIVER: "s3", S3_BUCKET: "documentos", S3_ENDPOINT: "https://abcd.storage.supabase.co/storage/v1/s3", S3_FORCE_PATH_STYLE: "true" })).toEqual(["https://abcd.storage.supabase.co"]);
    expect(s3Origins({ STORAGE_DRIVER: "s3", S3_BUCKET: "docs", S3_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com" })).toEqual(["https://cuenta.r2.cloudflarestorage.com", "https://docs.cuenta.r2.cloudflarestorage.com"]);
    expect(s3Origins({ STORAGE_DRIVER: "s3", S3_BUCKET: "docs", S3_REGION: "eu-west-1" })).toEqual(["https://docs.s3.eu-west-1.amazonaws.com", "https://docs.s3.amazonaws.com"]);
    const connect = buildCsp("n", { STORAGE_DRIVER: "s3", S3_BUCKET: "documentos", S3_ENDPOINT: "https://abcd.storage.supabase.co/storage/v1/s3", S3_FORCE_PATH_STYLE: "true" }).split("; ").find((d) => d.startsWith("connect-src"));
    expect(connect).toBe("connect-src 'self' https://api.hacienda.go.cr https://abcd.storage.supabase.co");
  });
});
