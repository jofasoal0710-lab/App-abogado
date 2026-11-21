import { describe, expect, it } from "vitest";
import { actionPrescription, penaltyPrescription } from "../src/lib/penal";
import { detectProcedure } from "../src/lib/assistant-reason";

describe("prescripción de la acción penal (CPP arts. 31-33)", () => {
  it("prisión: igual al máximo, entre 3 y 10 años", () => {
    expect(actionPrescription({ kind: "prision", maxPenaltyYears: 6, committedOn: "2022-03-01" }).due).toBe("2028-03-01");
    expect(actionPrescription({ kind: "prision", maxPenaltyYears: 1, committedOn: "2022-03-01" }).years).toBe(3);
    expect(actionPrescription({ kind: "prision", maxPenaltyYears: 15, committedOn: "2022-03-01" }).years).toBe(10);
  });
  it("con interrupción: la mitad, desde el último acto", () => {
    const r = actionPrescription({ kind: "prision", maxPenaltyYears: 6, committedOn: "2022-03-01", lastInterruptionOn: "2024-05-10" });
    expect(r.dueAfterInterruption).toBe("2027-05-10");
    const r2 = actionPrescription({ kind: "prision", maxPenaltyYears: 5, committedOn: "2022-03-01", lastInterruptionOn: "2024-05-10" });
    expect(r2.dueAfterInterruption).toBe("2026-11-10"); // 2 años y 6 meses
  });
  it("víctima menor: corre desde la mayoría de edad", () => {
    expect(actionPrescription({ kind: "prision", maxPenaltyYears: 8, committedOn: "2015-01-01", victimAdultOn: "2020-06-15" }).due).toBe("2028-06-15");
    expect(actionPrescription({ kind: "sexual_menor", committedOn: "2010-01-01", victimAdultOn: "2018-02-01" }).due).toBe("2043-02-01");
  });
  it("contravenciones 2 años; persona jurídica 10; función pública 30", () => {
    expect(actionPrescription({ kind: "no_privativa", committedOn: "2025-01-31" }).due).toBe("2027-01-31");
    expect(actionPrescription({ kind: "persona_juridica", committedOn: "2025-01-31" }).years).toBe(10);
    expect(actionPrescription({ kind: "funcion_publica", committedOn: "2020-02-29" }).due).toBe("2050-02-28");
  });
});

describe("prescripción de la pena (CP art. 84)", () => {
  it("la condena más un tercio, entre 3 y 25", () => {
    expect(penaltyPrescription({ sentenceYears: 6, firmOn: "2024-01-10" })).toMatchObject({ years: 8, due: "2032-01-10" });
    expect(penaltyPrescription({ sentenceYears: 1, firmOn: "2024-01-10" }).years).toBe(3);
    expect(penaltyPrescription({ sentenceYears: 30, firmOn: "2024-01-10" }).years).toBe(25);
    expect(penaltyPrescription({ sentenceYears: 0, kind: "contravencion", firmOn: "2024-01-10" }).due).toBe("2025-01-10");
  });
});

describe("plazos de recursos penales", () => {
  it("distingue el proceso penal del civil", () => {
    expect(detectProcedure("¿cuánto tengo para apelar la sentencia penal?")?.days).toBe(15);
    expect(detectProcedure("plazo para apelar la sentencia")?.days).toBe(5);
    expect(detectProcedure("casación penal")?.ref).toBe("CPP art. 469");
    expect(detectProcedure("revocatoria contra lo que resolvió el fiscal")?.ref).toBe("CPP art. 450");
  });
});

import { parsePrescriptionQuestion } from "../src/lib/penal";
import { parseIntent } from "../src/lib/assistant-intent";
describe("asistente: prescripción penal", () => {
  it("lee la pena y el tipo", () => {
    expect(parsePrescriptionQuestion("¿cuándo prescribe un delito con pena máxima de 6 años cometido el 01/03/2022?")).toEqual({ kind: "prision", maxPenaltyYears: 6 });
    expect(parsePrescriptionQuestion("prescripción de una contravención")).toEqual({ kind: "no_privativa" });
    expect(parsePrescriptionQuestion("cuándo prescribe el peculado")?.kind).toBe("funcion_publica");
    expect(parsePrescriptionQuestion("cuándo prescriben los derechos laborales")).toBeNull();
  });
  it("es una consulta jurídica", () => {
    expect(parseIntent("¿cuándo prescribe un delito con pena máxima de 6 años cometido el 01/03/2022?").kind).toBe("consulta");
  });
});

import { getTemplate } from "../src/lib/forms/templates";
describe("escritos penales", () => {
  it("el asistente reconoce cada escrito", () => {
    const g = (t: string) => { const i = parseIntent(t); return i.kind === "generar" ? i.template : i.kind; };
    expect(g("genera una denuncia penal para EXP-2026-0001")).toBe("denuncia-penal");
    expect(g("redacta una querella por difamación")).toBe("querella-accion-privada");
    expect(g("prepara la apelación de sentencia penal")).toBe("apelacion-sentencia-penal");
    expect(g("genera la solicitud de suspensión del proceso a prueba")).toBe("solicitud-medida-alterna");
    expect(g("redacta el cese de la prisión preventiva")).toBe("cese-prision-preventiva");
    expect(g("genera un recurso de revocatoria")).toBe("recurso-revocatoria-apelacion");
  });
  it("la denuncia se redacta con los hechos y la petitoria", () => {
    const t = getTemplate("denuncia-penal")!;
    const blocks = t.render({ juzgado: "Fiscalía Adjunta de Fraudes", cliente: "Ana Pérez", cedula: "1-1111-1111", contraparte: "Juan Mora", delito: "estafa", hechos: "Le entregué ₡1 000 000\nNunca entregó el carro" });
    const text = JSON.stringify(blocks);
    expect(text).toContain("SEÑOR(A) FISCAL DE LA FISCALÍA ADJUNTA DE FRAUDES");
    expect(text).toContain("DENUNCIA PENAL contra Juan Mora por el delito de estafa");
    expect(text).toContain("Nunca entregó el carro");
  });
});

describe("preguntas penales al asistente", () => {
  it("van a la base de conocimiento y a los códigos", () => {
    for (const q of ["¿cuánto dura la prisión preventiva?", "requisitos de la suspensión del proceso a prueba", "¿qué delitos son de acción privada?", "¿cuándo procede el procedimiento abreviado?"]) expect(parseIntent(q).kind).toBe("consulta");
  });
});

describe("plazos penales: cualquier orden de palabras", () => {
  it("«sentencia penal… apelación»", () => {
    expect(detectProcedure("me notificaron la sentencia penal el 20/11/2026, ¿cuándo vence la apelación?")?.key).toBe("apelacion_sentencia_penal");
  });
});
