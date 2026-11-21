import { describe, expect, it } from "vitest";
import { alimonyArrears, divorceAgreementDeadline, pensionYear, unionCaducity } from "../src/lib/familia";
import { detectProcedure } from "../src/lib/assistant-reason";

const C = (n: number) => n * 100;

describe("pensión alimentaria", () => {
  it("año: 12 cuotas + aguinaldo (+ salario escolar)", () => {
    expect(pensionYear(C(150_000)).totalCents).toBe(C(1_950_000));
    expect(pensionYear(C(150_000), { escolar: true })).toMatchObject({ escolarCents: C(150_000), totalCents: C(2_100_000) });
  });
  it("apremio: hasta seis cuotas y la gradualidad 2-4-6 meses", () => {
    const r = alimonyArrears({ monthlyCents: C(100_000), monthsOwed: 9 });
    expect(r).toMatchObject({ owedCents: C(900_000), apremioCents: C(600_000), beyondApremioCents: C(300_000), maxDetentionMonths: 2 });
    expect(alimonyArrears({ monthlyCents: C(100_000), monthsOwed: 3, order: 2 }).maxDetentionMonths).toBe(4);
    expect(alimonyArrears({ monthlyCents: C(100_000), monthsOwed: 3, order: 5 }).maxDetentionMonths).toBe(6);
  });
});

describe("plazos de familia", () => {
  it("unión de hecho: caduca a los dos años; convenio de divorcio: tres meses", () => {
    expect(unionCaducity("2025-02-28").due).toBe("2027-02-28");
    expect(divorceAgreementDeadline("2026-11-30").due).toBe("2027-02-28");
  });
  it("recursos y contestación según el CPF", () => {
    expect(detectProcedure("¿cuánto tengo para contestar la demanda de divorcio?")).toMatchObject({ days: 8, ref: "CPF art. 223" });
    expect(detectProcedure("oposición a la sentencia anticipada de la pensión")?.days).toBe(5);
    expect(detectProcedure("casación en un proceso de familia")?.days).toBe(10);
    expect(detectProcedure("contestar la demanda ordinaria")?.days).toBe(30);
  });
});

import { parseIntent } from "../src/lib/assistant-intent";
import { getTemplate } from "../src/lib/forms/templates";
describe("asistente y escritos de familia", () => {
  const g = (t: string) => { const i = parseIntent(t); return i.kind === "generar" ? i.template : i.kind; };
  it("reconoce los escritos", () => {
    expect(g("genera una demanda de pensión alimentaria")).toBe("demanda-pension-alimentaria");
    expect(g("redacta la solicitud de apremio corporal")).toBe("solicitud-apremio-corporal");
    expect(g("prepara la demanda de divorcio para EXP-2026-0001")).toBe("demanda-divorcio");
    expect(g("genera el escrito del convenio de divorcio por mutuo consentimiento")).toBe("aprobacion-convenio-divorcio");
    expect(g("redacta el reconocimiento de unión de hecho")).toBe("reconocimiento-union-hecho");
    expect(g("genera una demanda laboral")).toBe("demanda-laboral");
  });
  it("las preguntas de familia son consultas jurídicas", () => {
    for (const q of ["¿qué incluye la pensión alimentaria?", "causales de divorcio", "¿cuánto tiempo hay para reconocer una unión de hecho?", "¿cuántas cuotas cubre el apremio corporal?"]) expect(parseIntent(q).kind).toBe("consulta");
  });
  it("la demanda de pensión pide aguinaldo, escolar y conciliación", () => {
    const t = JSON.stringify(getTemplate("demanda-pension-alimentaria")!.render({ juzgado: "Juzgado de Pensiones Alimentarias de San José", cliente: "Ana", contraparte: "Luis", beneficiarios: "María, 8 años — ₡150 000", hechos: "Luis es el padre" }));
    expect(t).toContain("DEMANDA DE PENSIÓN ALIMENTARIA contra Luis");
    expect(t).toContain("aguinaldo");
    expect(t).toContain("art. 269");
  });
});
