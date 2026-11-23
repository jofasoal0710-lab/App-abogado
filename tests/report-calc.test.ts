import { describe, expect, it } from "vitest";
import { agingBucket, fmtHours, groupSum, hoursValueCents, pct, resolvePeriod } from "../src/lib/report-calc";

describe("periodos", () => {
  const t = "2026-11-23";
  it("atajos", () => {
    expect(resolvePeriod({}, t)).toMatchObject({ from: "2026-11-01", to: "2026-11-30", label: "noviembre de 2026" });
    expect(resolvePeriod({ preset: "mes_anterior" }, t)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod({ preset: "mes_anterior" }, "2026-01-10")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolvePeriod({ preset: "trimestre" }, t)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
    expect(resolvePeriod({ preset: "anio" }, t)).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(resolvePeriod({ preset: "ultimos_12" }, t)).toMatchObject({ from: "2025-12-01", to: "2026-11-30" });
  });
  it("fechas propias (y se ignoran si están al revés)", () => {
    expect(resolvePeriod({ from: "2026-02-01", to: "2026-02-15" }, t)).toMatchObject({ key: "personalizado", from: "2026-02-01" });
    expect(resolvePeriod({ from: "2026-03-01", to: "2026-02-15" }, t).key).toBe("mes");
  });
});

describe("antigüedad de la cartera", () => {
  it("tramos", () => {
    expect(agingBucket("2026-11-30", "2026-11-23")).toBe("al_dia");
    expect(agingBucket("2026-11-23", "2026-11-23")).toBe("al_dia");
    expect(agingBucket("2026-11-01", "2026-11-23")).toBe("d1_30");
    expect(agingBucket("2026-09-30", "2026-11-23")).toBe("d31_60");
    expect(agingBucket("2026-09-01", "2026-11-23")).toBe("d61_90");
    expect(agingBucket("2026-01-01", "2026-11-23")).toBe("d90");
  });
});

describe("agregaciones", () => {
  it("suma por clave y ordena", () => {
    const r = groupSum([{ c: "A", v: 5 }, { c: "B", v: 7 }, { c: "A", v: 4 }], (x) => x.c, { total: (x) => x.v }, "total");
    expect(r).toEqual([{ key: "A", total: 9 }, { key: "B", total: 7 }]);
  });
  it("valor de horas, porcentaje y formato", () => {
    expect(hoursValueCents(90, 4000000)).toBe(6000000);
    expect(pct(1, 3)).toBe(33);
    expect(pct(5, 0)).toBe(0);
    expect(fmtHours(90)).toBe("1,5");
  });
});
