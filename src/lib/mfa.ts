import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeRecovery, verifyTotp } from "./mfa-core";

/**
 * Segundo factor (SEC-003). El secreto TOTP se guarda cifrado (AES-256-GCM, clave derivada de AUTH_SECRET
 * con HKDF): quien lea la base de datos no puede generar códigos. Si se cambia AUTH_SECRET, los segundos
 * factores dejan de valer y un administrador debe restablecerlos (Equipo → editar persona).
 */
function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET no está definido");
  return Buffer.from(hkdfSync("sha256", secret, "app-abogado", "mfa-totp-v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${enc.toString("base64url")}.${c.getAuthTag().toString("base64url")}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, enc, tag] = stored.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Comprueba un código (de la app o de recuperación) de una persona con el segundo factor activo o en
 * activación (`pending`). Si vale, lo «gasta» (anti-repetición / código de recuperación usado).
 */
export async function checkSecondFactor(userId: number, code: string, opts: { pending?: boolean } = {}): Promise<"totp" | "recovery" | null> {
  const [u] = await db
    .select({ secret: users.mfaSecret, enabledAt: users.mfaEnabledAt, recovery: users.mfaRecoveryHashes, lastStep: users.mfaLastStep })
    .from(users)
    .where(eq(users.id, userId));
  if (!u?.secret || (!opts.pending && !u.enabledAt)) return null;
  const secret = decryptSecret(u.secret);
  if (!secret) return null;
  const step = verifyTotp(secret, code, Date.now(), u.lastStep ?? null);
  if (step !== null) {
    await db.update(users).set({ mfaLastStep: step }).where(eq(users.id, userId));
    return "totp";
  }
  if (!opts.pending && u.recovery) {
    const left = consumeRecovery(u.recovery, code);
    if (left) {
      await db.update(users).set({ mfaRecoveryHashes: left }).where(eq(users.id, userId));
      return "recovery";
    }
  }
  return null;
}

/* Inicio de sesión en dos pasos: tras la contraseña, una cookie firmada de 5 minutos lleva a /login/verificacion. */
const PENDING_COOKIE = "mfa_pendiente";
const PENDING_MINUTES = 5;

function jwtKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

export async function setPendingLogin(userId: number, next: string): Promise<void> {
  const token = await new SignJWT({ userId, next, purpose: "mfa" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${PENDING_MINUTES}m`).sign(jwtKey());
  (await cookies()).set(PENDING_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/login", maxAge: PENDING_MINUTES * 60 });
}

export async function readPendingLogin(): Promise<{ userId: number; next: string } | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ["HS256"] });
    const p = payload as { userId?: unknown; next?: unknown; purpose?: unknown };
    return p.purpose === "mfa" && typeof p.userId === "number" ? { userId: p.userId, next: typeof p.next === "string" ? p.next : "/" } : null;
  } catch {
    return null;
  }
}

export async function clearPendingLogin(): Promise<void> {
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/login" });
}
