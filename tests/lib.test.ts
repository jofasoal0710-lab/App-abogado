import { describe, expect, it } from "vitest";
import { formatNumber, nextSequence } from "../src/lib/numbering";

describe("numeración", () => {
  it("formatea con ceros a la izquierda", () => {
    expect(formatNumber("EXP", 2026, 1)).toBe("EXP-2026-0001");
    expect(formatNumber("FAC", 2026, 12345)).toBe("FAC-2026-12345");
  });

  it("empieza en 1 si no hay número previo", () => {
    expect(nextSequence(null, "EXP", 2026)).toBe(1);
    expect(nextSequence(undefined, "EXP", 2026)).toBe(1);
  });

  it("incrementa el último número del mismo año", () => {
    expect(nextSequence("EXP-2026-0009", "EXP", 2026)).toBe(10);
  });

  it("reinicia al cambiar de año o si el formato no coincide", () => {
    expect(nextSequence("EXP-2025-0420", "EXP", 2026)).toBe(1);
    expect(nextSequence("FAC-2026-0003", "EXP", 2026)).toBe(1);
    expect(nextSequence("basura", "EXP", 2026)).toBe(1);
  });
});

import { buildMonthGrid, daysUntil, addDaysISO, formatDate } from "../src/lib/dates";

describe("calendario", () => {
  it("construye semanas completas de lunes a domingo", () => {
    const weeks = buildMonthGrid("2026-11"); // 1-nov-2026 es domingo
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks[0][6]).toBe("2026-11-01");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(weeks.flat()).toContain("2026-11-30");
  });

  it("un mes que empieza en lunes no añade días previos", () => {
    const weeks = buildMonthGrid("2026-06"); // 1-jun-2026 es lunes
    expect(weeks[0][0]).toBe("2026-06-01");
  });

  it("febrero de 28 días que empieza en lunes ocupa 4 semanas", () => {
    expect(buildMonthGrid("2027-02")).toHaveLength(4); // 1-feb-2027 es lunes
  });
});

describe("fechas", () => {
  it("formatea fechas ISO sin desplazamientos de zona horaria", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate(null)).toBe("—");
  });

  it("suma días cruzando fin de mes y año", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula días hasta una fecha", () => {
    const now = new Date(2026, 10, 14, 18, 30);
    expect(daysUntil(new Date(2026, 10, 14, 8, 0), now)).toBe(0);
    expect(daysUntil(new Date(2026, 10, 17, 8, 0), now)).toBe(3);
    expect(daysUntil(new Date(2026, 10, 13, 23, 59), now)).toBe(-1);
  });
});

import { summarizeInvoice } from "../src/lib/invoices";

describe("resumen de factura", () => {
  const items = [{ unit: "horas" as const, quantity: 120, unitPriceCents: 10000 }]; // 200,00
  it("calcula pendiente y vencimiento solo en facturas emitidas", () => {
    const base = { taxRate: 21, items, payments: [{ amountCents: 10000 }], dueDate: "2026-11-01" };
    const emitted = summarizeInvoice({ ...base, status: "emitida" }, "2026-11-14");
    expect(emitted.totalCents).toBe(24200);
    expect(emitted.outstandingCents).toBe(14200);
    expect(emitted.overdue).toBe(true);

    const paid = summarizeInvoice({ ...base, status: "pagada", payments: [{ amountCents: 24200 }] }, "2026-11-14");
    expect(paid.outstandingCents).toBe(0);
    expect(paid.overdue).toBe(false);

    const voided = summarizeInvoice({ ...base, status: "anulada", payments: [] }, "2026-11-14");
    expect(voided.outstandingCents).toBe(0);
  });
});
