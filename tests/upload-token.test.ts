import { describe, expect, it } from "vitest";
import { signUploadToken, verifyUploadToken, type UploadClaim } from "../src/lib/upload-token";

const SECRET = "secreto-de-prueba-largo-1234567890";
const NOW = 1_800_000_000_000;
const claim: UploadClaim = {
  key: "0d6f3b0e-1c5a-4a6e-8f0a-0123456789ab.pdf",
  matterId: 7,
  name: "demanda.pdf",
  size: 123456,
  category: "Contrato",
  mime: "application/pdf",
  userId: 2,
  exp: NOW + 60_000,
};

describe("token de subida", () => {
  it("un token válido se verifica y devuelve exactamente lo firmado", () => {
    const t = signUploadToken(claim, SECRET);
    expect(verifyUploadToken(t, SECRET, NOW)).toEqual(claim);
  });

  it("caduca", () => {
    const t = signUploadToken(claim, SECRET);
    expect(verifyUploadToken(t, SECRET, claim.exp + 1)).toBeNull();
    expect(verifyUploadToken(t, SECRET, claim.exp - 1)).not.toBeNull();
  });

  it("con otro secreto no se verifica", () => {
    expect(verifyUploadToken(signUploadToken(claim, SECRET), "otro-secreto-distinto-123456", NOW)).toBeNull();
  });

  it("si se altera cualquier dato del contenido, la firma deja de valer", () => {
    const t = signUploadToken(claim, SECRET);
    const [body, sig] = t.split(".");
    const forged = { ...claim, matterId: 8 }; // intentar registrar el fichero en otro expediente
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(verifyUploadToken(`${forgedBody}.${sig}`, SECRET, NOW)).toBeNull();
    const bigger = Buffer.from(JSON.stringify({ ...claim, size: 1 })).toString("base64url");
    expect(verifyUploadToken(`${bigger}.${sig}`, SECRET, NOW)).toBeNull();
    expect(body).not.toBe(forgedBody);
  });

  it.each(["", "abc", "a.b.c", "....", ".", "x."])("rechaza basura: %j", (t) => {
    expect(verifyUploadToken(t, SECRET, NOW)).toBeNull();
  });

  it("rechaza un cuerpo firmado correctamente pero con forma inválida", () => {
    // Firma válida sobre un JSON que no es un UploadClaim (p. ej. si algún día se firmara otra cosa con el mismo secreto)
    const bad = signUploadToken({ ...claim, size: "grande" as unknown as number }, SECRET);
    expect(verifyUploadToken(bad, SECRET, NOW)).toBeNull();
  });

  it("la categoría puede ser null", () => {
    const t = signUploadToken({ ...claim, category: null }, SECRET);
    expect(verifyUploadToken(t, SECRET, NOW)?.category).toBeNull();
  });
});
