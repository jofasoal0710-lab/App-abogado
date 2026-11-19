import { describe, expect, it } from "vitest";
import { quincena, quincenaOf, shiftQuincena } from "../src/lib/notary-period";

describe("quincenas del índice notarial", () => {
  it("del 1 al 15 y del 16 al último día", () => {
    expect(quincenaOf("2026-11-15")).toMatchObject({ key: "2026-11-1", start: "2026-11-01", end: "2026-11-15" });
    expect(quincenaOf("2026-11-16")).toMatchObject({ key: "2026-11-2", start: "2026-11-16", end: "2026-11-30" });
    expect(quincena("2028-02-2")).toMatchObject({ end: "2028-02-29", label: "Del 16 al 29 de febrero de 2028" });
  });
  it("anterior y siguiente, cruzando meses y años", () => {
    expect(shiftQuincena("2026-12-2", 1)).toBe("2027-01-1");
    expect(shiftQuincena("2027-01-1", -1)).toBe("2026-12-2");
    expect(shiftQuincena("2026-11-1", 1)).toBe("2026-11-2");
  });
  it("claves no válidas", () => {
    expect(quincena("2026-13-1")).toBeNull();
    expect(quincena("2026-11-3")).toBeNull();
  });
});
