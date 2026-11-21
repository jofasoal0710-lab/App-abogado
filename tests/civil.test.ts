import { describe, expect, it } from "vitest";
import { amparoDeadline, civilPrescription, parseCivilPrescriptionQuestion } from "../src/lib/civil";

describe("prescripción civil (CC arts. 868-880)", () => {
  it("general 10 años; honorarios 3; alquiler mensual 1", () => {
    expect(civilPrescription({ claim: "general", exigibleOn: "2020-03-01" }).due).toBe("2030-03-01");
    expect(civilPrescription({ claim: "honorarios", exigibleOn: "2024-02-29" }).due).toBe("2027-02-28");
    expect(civilPrescription({ claim: "periodicas_menor", exigibleOn: "2026-01-15" }).due).toBe("2027-01-15");
  });
  it("la interrupción reinicia el plazo completo (art. 878)", () => {
    expect(civilPrescription({ claim: "honorarios", exigibleOn: "2022-01-10", lastInterruptionOn: "2024-06-01" }).due).toBe("2027-06-01");
  });
  it("lee la pregunta", () => {
    expect(parseCivilPrescriptionQuestion("¿cuándo prescribe una deuda exigible desde el 01/03/2020?")).toBe("general");
    expect(parseCivilPrescriptionQuestion("prescripción de mis honorarios")).toBe("honorarios");
    expect(parseCivilPrescriptionQuestion("cuándo prescribe un delito")).toBeNull();
    expect(parseCivilPrescriptionQuestion("cuándo prescriben los derechos laborales")).toBeNull();
  });
});

describe("amparo (LJC art. 35)", () => {
  it("dos meses", () => {
    expect(amparoDeadline({ from: "2026-12-31" }).due).toBe("2027-02-28");
  });
});

import { parseIntent } from "../src/lib/assistant-intent";
describe("asistente: civil y constitucional", () => {
  const g = (t: string) => { const i = parseIntent(t); return i.kind === "generar" ? i.template : i.kind; };
  it("escritos", () => {
    expect(g("genera un recurso de amparo contra la CCSS")).toBe("recurso-amparo");
    expect(g("redacta un hábeas corpus")).toBe("recurso-habeas-corpus");
    expect(g("prepara una demanda monitoria")).toBe("demanda-monitoria");
    expect(g("genera un recurso de revocatoria")).toBe("recurso-revocatoria-apelacion");
  });
  it("preguntas", () => {
    for (const q of ["¿cuándo prescribe una deuda exigible desde el 01/03/2020?", "¿cuál es el plazo para el recurso de amparo?", "¿qué bienes son inembargables?", "¿cuándo procede el hábeas corpus?"]) expect(parseIntent(q).kind).toBe("consulta");
  });
});
