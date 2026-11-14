import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatMoney,
  invoiceTotals,
  lineAmountCents,
  parseDurationToMinutes,
  parseMoneyToCents,
  parseQuantityToHundredths,
  timeAmountCents,
} from "../src/lib/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["150", 15000],
    ["150,5", 15050],
    ["150.5", 15050],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.500", 150000],
    ["12.345.678", 1234567800],
    ["0,75", 75],
    ["0.75", 75],
    [" 200 € ", 20000],
    ["-50", -5000],
    [",5", 50],
  ])("%s → %i", (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "12,345,6", "1.2.3a", "1.2.3", "10,999"])("rechaza %j", (input) => {
    // "1,234" es ambiguo en es-ES (decimal con 3 cifras): se rechaza en vez de adivinar.
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe("importes y totales", () => {
  it("1 h 25 min a 150 €/h son exactamente 212,50 €", () => {
    expect(timeAmountCents(85, 15000)).toBe(21250);
    expect(lineAmountCents({ unit: "horas", quantity: 85, unitPriceCents: 15000 })).toBe(21250);
  });

  it("líneas por unidades usan centésimas", () => {
    expect(lineAmountCents({ unit: "unidades", quantity: 150, unitPriceCents: 1000 })).toBe(1500);
    expect(lineAmountCents({ unit: "unidades", quantity: 100, unitPriceCents: 99999 })).toBe(99999);
  });

  it("calcula subtotal, IVA y total", () => {
    const t = invoiceTotals(
      [
        { unit: "horas", quantity: 90, unitPriceCents: 20000 }, // 300,00
        { unit: "unidades", quantity: 100, unitPriceCents: 5033 }, // 50,33
      ],
      21,
    );
    expect(t.subtotalCents).toBe(35033);
    expect(t.taxCents).toBe(7357); // 73,5693 → 73,57
    expect(t.totalCents).toBe(42390);
  });

  it("sin líneas el total es cero", () => {
    expect(invoiceTotals([], 21)).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe("duraciones", () => {
  it.each([
    ["1:30", 90],
    ["90", 90],
    ["90m", 90],
    ["2h", 120],
    ["1h 15m", 75],
    ["1,5", 90],
    ["1.25h", 75],
    ["0:45", 45],
  ])("%s → %i min", (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });

  it.each(["", "abc", "1:75", "-5"])("rechaza %j", (input) => {
    expect(parseDurationToMinutes(input)).toBeNull();
  });

  it("formatea duraciones", () => {
    expect(formatDuration(85)).toBe("1 h 25 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
  });

  it("parsea cantidades", () => {
    expect(parseQuantityToHundredths("1,5")).toBe(150);
    expect(parseQuantityToHundredths("2")).toBe(200);
    expect(parseQuantityToHundredths("1,555")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("agrupa miles siempre, también en importes de 4 cifras", () => {
    const norm = (s: string) => s.replace(/\u00a0/g, " ");
    expect(norm(formatMoney(150000))).toBe("1.500,00 €");
    expect(norm(formatMoney(1000000))).toBe("10.000,00 €");
    expect(norm(formatMoney(21250))).toBe("212,50 €");
  });
});
