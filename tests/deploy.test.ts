import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "../src/lib/client-ip";
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
