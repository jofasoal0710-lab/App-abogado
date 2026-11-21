import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { PASSWORD_MAX, PASSWORD_MIN, newPasswordProblem, passwordProblem } from "../src/lib/passwords";
import { NOTABLE_EVENTS, SECURITY_EVENT_LABELS } from "../src/lib/security-events";
import { SESSION_HOURS, hashSessionId, signSession, verifySession } from "../src/lib/session-token";

const SID = "a".repeat(43);

describe("reglas de contraseña", () => {
  it("longitud mínima y máxima", () => {
    expect(passwordProblem("x".repeat(PASSWORD_MIN - 1))).toMatch(/al menos 10/);
    expect(passwordProblem("x".repeat(PASSWORD_MIN))).toBeNull();
    expect(passwordProblem("x".repeat(PASSWORD_MAX + 1))).toMatch(/no puede superar/);
  });
  it("cambio: la repetición debe coincidir y la nueva debe ser distinta de la actual", () => {
    expect(newPasswordProblem("Actual-123456", "Nueva-1234567", "Nueva-1234567")).toBeNull();
    expect(newPasswordProblem("Actual-123456", "Nueva-1234567", "Nueva-1234568")).toMatch(/no coinciden/);
    expect(newPasswordProblem("Misma-1234567", "Misma-1234567", "Misma-1234567")).toMatch(/distinta de la actual/);
    expect(newPasswordProblem("Actual-123456", "corta", "corta")).toMatch(/al menos/);
  });
});

describe("token de sesión (OWASP-A07-001)", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "secreto-de-pruebas-de-al-menos-32-caracteres";
  });
  it("firma y verifica { userId, sid }", async () => {
    expect(await verifySession(await signSession({ userId: 7, sid: SID }))).toEqual({ userId: 7, sid: SID });
  });
  it("los tokens del formato anterior (sin identificador de sesión) ya no valen", async () => {
    const old = await new SignJWT({ userId: 7 }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    expect(await verifySession(old)).toBeNull();
  });
  it("rechaza tokens alterados, con otra clave o con un identificador demasiado corto", async () => {
    const token = await signSession({ userId: 7, sid: SID });
    // Se cambia un carácter del medio de la firma (los últimos solo llevan bits de relleno en base64url).
    const i = token.length - 20;
    expect(await verifySession(token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1))).toBeNull();
    const other = await new SignJWT({ userId: 7, sid: SID }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode("otra-clave-distinta-de-la-buena-123456"));
    expect(await verifySession(other)).toBeNull();
    expect(await verifySession(await signSession({ userId: 7, sid: "corto" }))).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
  it("caduca en una jornada", async () => {
    const [, payload] = (await signSession({ userId: 7, sid: SID })).split(".");
    const { iat, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(exp - iat).toBe(SESSION_HOURS * 3600);
    expect(SESSION_HOURS).toBeLessThanOrEqual(12);
  });
  it("en la base de datos solo se guarda el hash del identificador", () => {
    const h = hashSessionId(SID);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(SID);
    expect(hashSessionId(SID)).toBe(h);
  });
});

describe("registro de seguridad", () => {
  it("todos los eventos importantes tienen descripción", () => {
    for (const k of NOTABLE_EVENTS) expect(SECURITY_EVENT_LABELS[k]).toBeTruthy();
  });
});
