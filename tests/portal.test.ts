import { describe, expect, it } from "vitest";
import { hashPortalToken, linkDays, linkStatus, looksLikePortalToken, newPortalToken } from "../src/lib/portal-core";

describe("portal del cliente", () => {
  it("tokens aleatorios de 256 bits y su hash", () => {
    const a = newPortalToken();
    expect(looksLikePortalToken(a)).toBe(true);
    expect(a).not.toBe(newPortalToken());
    expect(hashPortalToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(looksLikePortalToken("corto")).toBe(false);
    expect(looksLikePortalToken(a + "x")).toBe(false);
  });
  it("validez del enlace entre 1 y 90 días", () => {
    expect(linkDays("")).toBe(30);
    expect(linkDays("7")).toBe(7);
    expect(linkDays("0")).toBeNull();
    expect(linkDays("91")).toBeNull();
    expect(linkDays("1.5")).toBeNull();
  });
  it("estado del enlace", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(linkStatus({ revokedAt: null, expiresAt: new Date("2026-12-01") }, now)).toBe("activo");
    expect(linkStatus({ revokedAt: null, expiresAt: now }, now)).toBe("caducado");
    expect(linkStatus({ revokedAt: new Date(), expiresAt: new Date("2027-01-01") }, now)).toBe("revocado");
  });
});
