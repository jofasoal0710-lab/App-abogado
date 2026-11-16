import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token firmado que autoriza el REGISTRO de un fichero ya subido al bucket.
 * Sin estado: el servidor no guarda nada entre «preparar» y «finalizar»; si el token es válido,
 * lo que se registra es exactamente lo que se autorizó (usuario, expediente, nombre, tamaño y clave).
 */
export type UploadClaim = {
  key: string;
  matterId: number;
  name: string;
  size: number;
  category: string | null;
  mime: string;
  userId: number;
  /** Caducidad (ms desde epoch). */
  exp: number;
};

const LABEL = "upload-token:v1:";

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(LABEL + body).digest();
}

export function signUploadToken(claim: UploadClaim, secret: string): string {
  const body = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function verifyUploadToken(token: string, secret: string, now = Date.now()): UploadClaim | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = mac(body, secret);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let c: unknown;
  try {
    c = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const o = c as Record<string, unknown>;
  if (
    typeof o?.key !== "string" || typeof o.matterId !== "number" || typeof o.name !== "string" ||
    typeof o.size !== "number" || typeof o.mime !== "string" || typeof o.userId !== "number" ||
    typeof o.exp !== "number" || !(o.category === null || typeof o.category === "string")
  ) return null;
  if (o.exp < now) return null;
  return o as unknown as UploadClaim;
}
