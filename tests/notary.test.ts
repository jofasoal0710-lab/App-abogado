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

import { indexDeadline, indexRow, indexState } from "../src/lib/notary-index";
import { quincena as qz } from "../src/lib/notary-period";

describe("INDEX: plazo y estado del índice", () => {
  it("vence 5 días hábiles después del cierre, saltando fines de semana y feriados", () => {
    // 30 nov 2026 (lunes) + 5 hábiles, con el 1 de diciembre (Abolición del Ejército) feriado → 8 dic
    expect(indexDeadline(qz("2026-11-2")!)).toBe("2026-12-08");
    // 15 dic 2026 (martes) + 5 hábiles → 22 dic
    expect(indexDeadline(qz("2026-12-1")!)).toBe("2026-12-22");
  });
  it("en curso, pendiente, vencido o presentado", () => {
    const q = qz("2026-11-2")!;
    expect(indexState(q, "2026-11-25", null).kind).toBe("en_curso");
    expect(indexState(q, "2026-12-03", null)).toEqual({ kind: "pendiente", due: "2026-12-08", daysLeft: 5 });
    expect(indexState(q, "2026-12-09", null).kind).toBe("vencido");
    expect(indexState(q, "2026-12-20", { submittedOn: "2026-12-02", receipt: "A-1" })).toEqual({ kind: "presentado", on: "2026-12-02", receipt: "A-1" });
  });
  it("fila lista para copiar (tabuladores), con cédulas y «no pasó»", () => {
    const row = indexRow({
      number: 12, grantedOn: "2026-11-18", grantedAt: "diez horas", act: "Poder\tespecial", volume: "7", folioStart: 40, folioEnd: 41, status: "no_paso",
      parties: [{ name: "Ana Pérez", idNumber: "1-1111-1111" }, { name: "Juan Mora", idNumber: null }],
    });
    expect(row.split("\t")).toEqual(["12", "18/11/2026", "diez horas", "Poder especial (NO PASÓ)", "7", "40-41", "Ana Pérez (1-1111-1111); Juan Mora"]);
  });
});
