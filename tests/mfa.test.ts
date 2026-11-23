import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, consumeRecovery, hashRecovery, newRecoveryCodes, otpauthUri, totpAt, verifyTotp } from "../src/lib/mfa-core";
import { provisionalExpired } from "../src/lib/passwords";
import { insertionOrder } from "../src/lib/backup-core";

// Vector de la RFC 6238 (SHA-1): secreto ASCII «12345678901234567890».
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("coincide con los vectores oficiales", () => {
    expect(totpAt(RFC, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("base32 ida y vuelta", () => {
    expect(base32Decode(base32Encode(Buffer.from("hola mundo"))).toString()).toBe("hola mundo");
  });
  it("acepta ±30 s y rechaza el código repetido o viejo", () => {
    const t = 1111111109_000;
    const s = verifyTotp(RFC, "081804", t);
    expect(s).toBe(Math.floor(1111111109 / 30));
    expect(verifyTotp(RFC, "081804", t + 30_000)).not.toBeNull();
    expect(verifyTotp(RFC, "081804", t + 90_000)).toBeNull();
    expect(verifyTotp(RFC, "081804", t, s)).toBeNull(); // ya usado
    expect(verifyTotp(RFC, "12345", t)).toBeNull();
  });
  it("URI para la app de autenticación", () => {
    expect(otpauthUri("ABC", "ana@bufete.cr", "Bufete")).toBe("otpauth://totp/Bufete%3Aana%40bufete.cr?secret=ABC&issuer=Bufete&algorithm=SHA1&digits=6&period=30");
  });
});

describe("códigos de recuperación", () => {
  it("son de un solo uso", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(8);
    const hashes = codes.map(hashRecovery);
    const left = consumeRecovery(hashes, codes[2].toLowerCase());
    expect(left).toHaveLength(7);
    expect(consumeRecovery(left!, codes[2])).toBeNull();
    expect(consumeRecovery(hashes, "AAAA-AAAA")).toBeNull();
  });
});

describe("contraseña provisional", () => {
  it("caduca a los 7 días", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(provisionalExpired(new Date("2026-11-17T12:00:00Z"), now)).toBe(false);
    expect(provisionalExpired(new Date("2026-11-16T11:00:00Z"), now)).toBe(true);
    expect(provisionalExpired(null, now)).toBe(false);
  });
});

describe("restauración: orden por claves foráneas", () => {
  it("padres antes que hijos; detecta ciclos", () => {
    expect(insertionOrder(["matters", "clients", "users", "roles"], [["matters", "clients"], ["matters", "users"], ["users", "roles"], ["users", "users"]])).toEqual(["clients", "roles", "users", "matters"]);
    expect(() => insertionOrder(["a", "b"], [["a", "b"], ["b", "a"]])).toThrow(/circulares/);
  });
});
