import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Segundo factor TOTP (RFC 6238: HMAC-SHA1, 6 cifras, 30 s), compatible con Google Authenticator,
 * Microsoft Authenticator, Authy, 1Password… Puro (sin base de datos): exportado para los tests.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("Base32 no válido");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export const stepOf = (ms: number) => Math.floor(ms / 1000 / TOTP_STEP_SECONDS);

/**
 * Comprueba un código con ±1 intervalo de margen (reloj del móvil algo desfasado). Devuelve el intervalo
 * aceptado, o null. Rechaza intervalos ≤ `lastStep` (el mismo código no vale dos veces).
 */
export function verifyTotp(secret: string, code: string, nowMs: number, lastStep: number | null = null): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = stepOf(nowMs);
  for (const s of [now - 1, now, now + 1]) {
    if (lastStep !== null && s <= lastStep) continue;
    const a = Buffer.from(totpAt(secret, s));
    if (timingSafeEqual(a, Buffer.from(c))) return s;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/* Códigos de recuperación: 8 de un solo uso, «XXXX-XXXX», se guardan solo sus hashes. */
const RC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = [...b].map((x) => RC[x % RC.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashRecovery = (code: string) => createHash("sha256").update(normalizeRecovery(code)).digest("hex");

/** Si `code` es uno de los códigos de recuperación, devuelve los hashes restantes (sin él); si no, null. */
export function consumeRecovery(hashes: string[], code: string): string[] | null {
  if (normalizeRecovery(code).length !== 8) return null;
  const h = hashRecovery(code);
  return hashes.includes(h) ? hashes.filter((x) => x !== h) : null;
}
