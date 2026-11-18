import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/** Parte pura de las sesiones (firma, verificación y hash del identificador): sin base de datos ni cookies. */
export const SESSION_COOKIE = "session";
export const SESSION_HOURS = 12;

export type SessionPayload = { userId: number; sid: string };

export function hashSessionId(sid: string): string {
  return createHash("sha256").update(sid).digest("hex");
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET no está definido (mínimo 16 caracteres). Revisa tu .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

/** Comprueba firma y caducidad del token (no la base de datos). Los tokens antiguos sin `sid` no valen. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const { userId, sid } = payload as { userId?: unknown; sid?: unknown };
    return typeof userId === "number" && typeof sid === "string" && sid.length >= 32 ? { userId, sid } : null;
  } catch {
    return null;
  }
}
