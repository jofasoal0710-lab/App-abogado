import { describe, expect, it } from "vitest";
import { normalize, parseIntent } from "../src/lib/assistant-intent";

describe("asistente: qué se pregunta", () => {
  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normalize("¿Cuánto DEBE Gerson?")).toBe("cuanto debe gerson");
  });
  it("ayuda y resumen", () => {
    expect(parseIntent("hola").kind).toBe("ayuda");
    expect(parseIntent("¿qué puedes hacer?").kind).toBe("ayuda");
    expect(parseIntent("dame un resumen").kind).toBe("resumen");
  });
  it("expediente por número, en varias formas", () => {
    expect(parseIntent("estado del expediente EXP-2026-0001")).toEqual({ kind: "expediente", ref: "EXP-2026-0001" });
    expect(parseIntent("exp 2026-1")).toEqual({ kind: "expediente", ref: "EXP-2026-0001" });
    expect(parseIntent("como va el 2026-0003")).toEqual({ kind: "expediente", ref: "EXP-2026-0003" });
  });
  it("expediente por texto", () => {
    expect(parseIntent("expediente de despido")).toEqual({ kind: "expediente", ref: "despido" });
  });
  it("facturas", () => {
    expect(parseIntent("¿cuánto debe Gerson Villalobos?")).toEqual({ kind: "facturas_pendientes", client: "gerson villalobos" });
    expect(parseIntent("facturas pendientes")).toEqual({ kind: "facturas_pendientes", client: null });
    expect(parseIntent("facturas vencidas")).toEqual({ kind: "facturas_vencidas" });
  });
  it("plazos", () => {
    expect(parseIntent("plazos de esta semana")).toEqual({ kind: "plazos", days: 7 });
    expect(parseIntent("¿qué tengo hoy en la agenda?")).toEqual({ kind: "plazos", days: 1 });
    expect(parseIntent("audiencias del mes")).toEqual({ kind: "plazos", days: 31 });
  });
  it("clientes y búsqueda libre", () => {
    expect(parseIntent("información del cliente Gerson")).toEqual({ kind: "cliente", query: "gerson" });
    expect(parseIntent("expedientes activos").kind).toBe("expedientes_activos");
    expect(parseIntent("Villalobos")).toEqual({ kind: "buscar", query: "villalobos" });
  });
});
