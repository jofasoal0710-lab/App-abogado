import { describe, expect, it } from "vitest";
import { ageOn, formatId, guessIdType, validateId } from "../src/lib/cr-id";

describe("identificaciones de Costa Rica", () => {
  it("cédula física: 9 dígitos, admite guiones y espacios", () => {
    expect(validateId("cedula_fisica", "1-1234-0567")).toEqual({ ok: true, value: "112340567" });
    expect(validateId("cedula_fisica", " 112340567 ")).toEqual({ ok: true, value: "112340567" });
    expect(validateId("cedula_fisica", "12345678").ok).toBe(false);
    expect(validateId("cedula_fisica", "012345678").ok).toBe(false);
  });
  it("cédula jurídica: 10 dígitos que empiezan por 3", () => {
    expect(validateId("cedula_juridica", "3-101-123456")).toEqual({ ok: true, value: "3101123456" });
    expect(validateId("cedula_juridica", "4101123456").ok).toBe(false);
  });
  it("DIMEX 11-12 dígitos; NITE 10; pasaporte libre", () => {
    expect(validateId("dimex", "15580000123").ok).toBe(true);
    expect(validateId("dimex", "155800001234").ok).toBe(true);
    expect(validateId("dimex", "1558000012").ok).toBe(false);
    expect(validateId("nite", "1234567890").ok).toBe(true);
    expect(validateId("pasaporte", "AB123456")).toEqual({ ok: true, value: "AB123456" });
  });
  it("formato legible y tipo probable", () => {
    expect(formatId("cedula_fisica", "112340567")).toBe("1-1234-0567");
    expect(formatId("cedula_juridica", "3101123456")).toBe("3-101-123456");
    expect(formatId("pasaporte", "X1")).toBe("X1");
    expect(guessIdType("1-1234-0567")).toBe("cedula_fisica");
    expect(guessIdType("3-101-123456")).toBe("cedula_juridica");
    expect(guessIdType("155800001234")).toBe("dimex");
    expect(guessIdType("abc")).toBeNull();
  });
  it("edad cumplida, también el día antes y el día del cumpleaños", () => {
    expect(ageOn("1990-11-20", "2026-11-19")).toBe(35);
    expect(ageOn("1990-11-19", "2026-11-19")).toBe(36);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("2027-01-01", "2026-11-19")).toBeNull();
    expect(ageOn("no", "2026-11-19")).toBeNull();
  });
});
