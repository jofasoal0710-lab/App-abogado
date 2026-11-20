import { describe, expect, it } from "vitest";
import { cesantiaDays, laborSettlement, noticeDays, procedureDeadline, seniority } from "../src/lib/calculators";

describe("liquidación laboral (arts. 28, 29 y 30 del Código de Trabajo)", () => {
  it("antigüedad en años, meses y días", () => {
    expect(seniority("2023-04-15", "2026-11-20")).toMatchObject({ years: 3, months: 7, days: 5 });
  });
  it("preaviso según el art. 28", () => {
    expect(noticeDays(2).days).toBe(0);
    expect(noticeDays(4).days).toBe(7);
    expect(noticeDays(9).days).toBe(15);
    expect(noticeDays(30).days).toBe(30);
  });
  it("cesantía según la tabla del art. 29 (fracción > 6 meses = año; tope de 8 años)", () => {
    expect(cesantiaDays(5).days).toBe(7);
    expect(cesantiaDays(10).days).toBe(14);
    expect(cesantiaDays(12).days).toBe(19.5); // 1 año
    expect(cesantiaDays(18).days).toBe(19.5); // 1 año y 6 meses: la fracción no supera 6 meses
    expect(cesantiaDays(19).days).toBe(40); // 1 año y 7 meses → 2 años × 20
    expect(cesantiaDays(43).days).toBe(84); // 3 años y 7 meses → 4 años × 21
    expect(cesantiaDays(12 * 12).days).toBe(164); // 12 años → 20,5 × 8
    expect(cesantiaDays(20 * 12).days).toBe(160); // 20 años → 20 × 8
  });
  it("liquidación completa por despido sin justa causa", () => {
    const r = laborSettlement({ start: "2023-04-15", end: "2026-11-20", avgMonthlySalary: 600_000, withoutJustCause: true, pendingVacationDays: 6, aguinaldoBase: 6_000_000 });
    const by = Object.fromEntries(r.lines.map((l) => [l.concept, l]));
    expect(r.dailySalary).toBe(20_000);
    expect(by["Preaviso"].amount).toBe(600_000); // 30 días
    expect(by["Auxilio de cesantía"].days).toBe(84);
    expect(by["Auxilio de cesantía"].amount).toBe(1_680_000);
    expect(by["Vacaciones no disfrutadas"].amount).toBe(120_000);
    expect(by["Aguinaldo proporcional"].amount).toBe(500_000);
    expect(r.total).toBe(2_900_000);
  });
  it("renuncia: sin preaviso del patrono ni cesantía", () => {
    const r = laborSettlement({ start: "2025-01-01", end: "2026-06-30", avgMonthlySalary: 450_000, withoutJustCause: false });
    expect(r.lines.map((l) => l.concept)).toEqual(["Vacaciones no disfrutadas", "Aguinaldo proporcional"]);
  });
});

describe("plazos procesales (art. 30.5 del CPC)", () => {
  it("días hábiles desde el día hábil siguiente a la notificación", () => {
    // Notificado el viernes 20/11/2026: corre desde el lunes 23; 3 días → miércoles 25.
    expect(procedureDeadline({ notified: "2026-11-20", amount: 3, unit: "dias" })).toMatchObject({ start: "2026-11-23", due: "2026-11-25" });
    // 5 días desde el viernes 27/11: lunes 30, (1 dic feriado), 2, 3, 4, 7 → 7 de diciembre.
    expect(procedureDeadline({ notified: "2026-11-27", amount: 5, unit: "dias" }).due).toBe("2026-12-07");
  });
  it("días de cierre adicionales (p. ej. cierre colectivo)", () => {
    const r = procedureDeadline({ notified: "2026-12-22", amount: 3, unit: "dias", closedDays: ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"] });
    expect(r.due).toBe("2027-01-04"); // 23, 24, (25 feriado, 26-27 fin de semana, 28-31 cierre, 1 ene feriado, 2-3 fin de semana), 4
  });
  it("meses de fecha a fecha; si el día no existe, el último del mes; si es inhábil, el siguiente hábil", () => {
    expect(procedureDeadline({ notified: "2026-01-31", amount: 1, unit: "meses" }).due).toBe("2026-03-02"); // 28/2 es sábado → lunes 2/3
    expect(procedureDeadline({ notified: "2026-03-10", amount: 1, unit: "anos" }).due).toBe("2027-03-10");
  });
});
