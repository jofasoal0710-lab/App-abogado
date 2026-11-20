import { describe, expect, it } from "vitest";
import { bestPassage, detectProcedure, expandQuery, extractDate, extractDuration, extractSettlement, stem } from "../src/lib/assistant-reason";
import { GUIDE } from "../src/lib/knowledge-guide";

describe("asistente: entender la pregunta", () => {
  it("sinónimos hacia términos jurídicos", () => {
    expect(expandQuery("¿cuánto tiempo tengo para apelar?")).toContain("apelación");
    expect(expandQuery("me despidieron, qué me toca")).toContain("cesantía");
    expect(expandQuery("quiero desalojar al inquilino")).toContain("desahucio");
  });
  it("detecta el trámite y su plazo", () => {
    expect(detectProcedure("¿cuánto tengo para apelar una sentencia?")).toMatchObject({ days: 5 });
    expect(detectProcedure("plazo para apelar un auto")).toMatchObject({ days: 3 });
    expect(detectProcedure("¿cuándo vence la casación?")).toMatchObject({ days: 15 });
    expect(detectProcedure("plazo para contestar la demanda")).toMatchObject({ days: 30 });
    expect(detectProcedure("contestar en un sumario")).toMatchObject({ days: 5 });
    expect(detectProcedure("hola")).toBeNull();
  });
  it("fechas y duraciones", () => {
    expect(extractDate("notificado el 20/11", "2026-11-25")).toBe("2026-11-20");
    expect(extractDate("el 3/1/27", "2026-11-25")).toBe("2027-01-03");
    expect(extractDate("me notificaron hoy", "2026-11-25")).toBe("2026-11-25");
    expect(extractDuration("un plazo de 5 días hábiles")).toEqual({ amount: 5, unit: "dias" });
    expect(extractDuration("un mes")).toEqual({ amount: 1, unit: "meses" });
  });
  it("datos para la liquidación", () => {
    expect(extractSettlement("calcula la cesantía de 3 años y 7 meses con salario de 600 000")).toEqual({ years: 3, months: 7, salary: 600000, justCause: false });
    expect(extractSettlement("liquidación de 2 años, ganaba ₡450.000, renunció")).toEqual({ years: 2, months: 0, salary: 450000, justCause: true });
    expect(extractSettlement("despido sin justa causa 18 meses salario 1.200.000,00")).toMatchObject({ months: 18, salary: 1200000, justCause: false });
  });
});

describe("asistente: escoger el fragmento que responde", () => {
  it("raíces", () => {
    expect(stem("apelación")).toBe(stem("apelaciones"));
    expect(stem("plazos")).toBe(stem("plazo"));
  });
  it("de la guía de recursos, la línea de la apelación", () => {
    const recursos = GUIDE.find((g) => g.title.startsWith("Recursos"))!;
    expect(bestPassage(recursos.body, "plazo para apelar una sentencia apelación")).toContain("Apelación (art. 67)");
    expect(bestPassage(recursos.body, "casación")).toContain("15 días");
  });
});
