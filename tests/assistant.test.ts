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

describe("asistente: formularios y notariado", () => {
  it("generar un escrito para un expediente", () => {
    expect(parseIntent("genera una demanda laboral para el EXP-2026-0001")).toEqual({ kind: "generar", template: "demanda-laboral", ref: "EXP-2026-0001" });
    expect(parseIntent("redactar poder especial")).toEqual({ kind: "generar", template: "poder-especial", ref: null });
    expect(parseIntent("quiero hacer un recurso de apelación")).toMatchObject({ kind: "generar", template: "recurso-revocatoria-apelacion" });
    expect(parseIntent("crear escrito")).toEqual({ kind: "generar", template: null, ref: null });
  });
  it("escritos, formularios y notariado", () => {
    expect(parseIntent("escritos del expediente EXP-2026-0002")).toEqual({ kind: "escritos", ref: "EXP-2026-0002" });
    expect(parseIntent("¿qué formularios hay?")).toEqual({ kind: "formularios" });
    expect(parseIntent("¿cuál es la próxima escritura?")).toEqual({ kind: "notaria", what: "proxima" });
    expect(parseIntent("índice de la quincena")).toEqual({ kind: "notaria", what: "indice" });
    expect(parseIntent("últimas escrituras del protocolo")).toEqual({ kind: "notaria", what: "ultimas" });
  });
});

describe("asistente: normativa", () => {
  it("leyes por número, nombre o tema, y la normativa de un expediente", () => {
    expect(parseIntent("ley 7764")).toEqual({ kind: "normativa", query: "7764", ref: null, article: null });
    expect(parseIntent("¿qué dice el artículo 29 del código de trabajo?")).toEqual({ kind: "normativa", query: "codigo trabajo", ref: null, article: "29" });
    expect(parseIntent("articulo 97 bis codigo de trabajo")).toMatchObject({ article: "97 bis" });
    expect(parseIntent("código de familia")).toMatchObject({ kind: "normativa", query: "codigo familia" });
    expect(parseIntent("normativa del EXP-2026-0002")).toEqual({ kind: "normativa", query: "", ref: "EXP-2026-0002", article: null });
    // no roba otras intenciones
    expect(parseIntent("genera una demanda laboral para el EXP-2026-0001").kind).toBe("generar");
    expect(parseIntent("índice de la quincena").kind).toBe("notaria");
  });
});

describe("asistente: consultas jurídicas y cálculos", () => {
  it("preguntas en lenguaje natural van a la base de conocimiento", () => {
    expect(parseIntent("¿cuánto tiempo tengo para apelar una sentencia?").kind).toBe("consulta");
    expect(parseIntent("me notificaron el 20/11, ¿cuándo vence la casación?").kind).toBe("consulta");
    expect(parseIntent("¿qué pasa con la prescripción de un despido?").kind).toBe("consulta");
    expect(parseIntent("expediente de despido").kind).toBe("expediente");
    expect(parseIntent("plazos de esta semana").kind).toBe("plazos");
    expect(parseIntent("artículo 29 del código de trabajo").kind).toBe("normativa");
  });
  it("cálculo de liquidación", () => {
    expect(parseIntent("calcula la cesantía de 3 años y 7 meses con salario de 600 000").kind).toBe("liquidacion");
    expect(parseIntent("liquidación de 18 meses ganando 450000").kind).toBe("liquidacion");
  });
});

describe("asistente: crear, modificar, borrar o consultar", () => {
  const act = (t: string) => {
    const i = parseIntent(t);
    return i.kind === "accion" ? `${i.verb} ${i.entity}` : i.kind;
  };
  it("entiende las formas de pedir crear", () => {
    expect(act("quiero ingresar un nuevo cliente")).toBe("crear cliente");
    expect(act("cómo creo un expediente")).toBe("crear expediente");
    expect(act("agregar una audiencia")).toBe("crear evento");
    expect(act("registrar horas")).toBe("crear horas");
    expect(act("hacer una factura")).toBe("crear factura");
    expect(act("subir un documento")).toBe("crear documento");
  });
  it("modificar, borrar y consultar", () => {
    expect(act("modificar el cliente Gerson")).toBe("modificar cliente");
    expect(act("cambiar los datos del expediente EXP-2026-0001")).toBe("modificar expediente");
    expect(act("cómo borro una factura")).toBe("borrar factura");
    expect(act("eliminar un plazo")).toBe("borrar evento");
    expect(act("dónde veo los documentos")).toBe("consultar documento");
  });
  it("no confunde las preguntas que ya entendía", () => {
    expect(act("cliente Gerson")).toBe("cliente");
    expect(act("facturas pendientes")).not.toMatch(/^crear|^borrar/);
    expect(act("plazos de esta semana")).not.toMatch(/^crear|^borrar/);
    expect(act("generar demanda laboral para EXP-2026-0001")).not.toMatch(/^crear/);
  });
});
