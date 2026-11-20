import { describe, expect, it } from "vitest";
import { getObservedHolidaysForYear } from "@dojocoding/hacienda-sdk";
import { addBusinessDaysCR, easterSunday, holidaysOf, isBusinessDayCR } from "../src/lib/cr-holidays";
import { indexDeadline } from "../src/lib/notary-index";
import { quincena } from "../src/lib/notary-period";

describe("feriados de Costa Rica (art. 148)", () => {
  it("Semana Santa", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(holidaysOf(2027).find((h) => h.name === "Viernes Santo")!.date).toBe("2027-03-26");
  });
  it("2026 coincide con el calendario de Hacienda", () => {
    const ours = holidaysOf(2026).map((h) => h.date).sort();
    const sdk = getObservedHolidaysForYear(2026).map((h) => h.observed).sort();
    expect(ours).toEqual(sdk);
  });
  it("traslados del transitorio (2023 y 2024) y días hábiles", () => {
    expect(holidaysOf(2024).find((h) => h.name === "Juan Santamaría")!.date).toBe("2024-04-15");
    expect(holidaysOf(2023).find((h) => h.name === "Día de la Madre")!.date).toBe("2023-08-14");
    expect(isBusinessDayCR("2026-12-01")).toBe(false);
    expect(isBusinessDayCR("2026-12-02")).toBe(true);
    expect(addBusinessDaysCR("2026-12-31", 5)).toBe("2027-01-08"); // 1 ene feriado; 4,5,6,7,8
  });
  it("el plazo del índice notarial funciona también en 2027", () => {
    expect(indexDeadline(quincena("2026-12-2")!)).toBe("2027-01-08");
    expect(indexDeadline(quincena("2027-03-2")!)).toBe("2027-04-07"); // 31/3; 1-2 abr no son feriado en 2027 (Santos 25-26 mar)
  });
});
