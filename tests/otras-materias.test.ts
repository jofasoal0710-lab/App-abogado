import { describe, expect, it } from "vitest";
import { administrativeAppeal, commercialPrescription, contentiousDeadline, housingRentIncrease, leaseTerm, positiveSilence, taxPrescription, trafficTicketAppeal } from "../src/lib/otras-materias";

describe("administrativo", () => {
  it("recursos LGAP: 3 días hábiles (salta fines de semana y feriados)", () => {
    expect(administrativeAppeal("2026-11-20").due).toBe("2026-11-25"); // vie 20 → lun 23, mar 24, mié 25
    expect(administrativeAppeal("2026-11-27").due).toBe("2026-12-03"); // 1 de diciembre es feriado
  });
  it("contencioso: un año; avisa si vence en día inhábil", () => {
    expect(contentiousDeadline("2026-03-10")).toMatchObject({ due: "2027-03-10", nonWorking: false });
    expect(contentiousDeadline("2026-11-21").nonWorking).toBe(true); // 21/11/2027 es domingo
  });
  it("silencio positivo: un mes", () => expect(positiveSilence("2026-01-31").due).toBe("2026-02-28"));
  it("boleta de tránsito: 10 días hábiles", () => {
    expect(trafficTicketAppeal("2026-11-20").due).toBe("2026-12-07"); // salta el 1 de diciembre
    expect(trafficTicketAppeal("2026-11-20").actionPrescribes).toBe("2028-11-20");
  });
});

describe("prescripción mercantil", () => {
  it("cuatro años general; uno para intereses o alquileres", () => {
    expect(commercialPrescription({ claim: "general", dueOn: "2022-05-15" }).due).toBe("2026-05-15");
    expect(commercialPrescription({ claim: "intereses", dueOn: "2026-02-28" }).due).toBe("2027-02-28");
  });
  it("la interrupción reinicia el plazo completo", () => {
    expect(commercialPrescription({ claim: "letra", dueOn: "2021-01-10", interruptedOn: "2024-06-01" }).due).toBe("2028-06-01");
  });
});

describe("arrendamientos", () => {
  it("tres años, prórroga tácita y aviso tres meses antes", () => {
    expect(leaseTerm("2020-02-01", "2026-11-23")).toMatchObject({ start: "2026-02-01", end: "2029-02-01", renewals: 2, noticeBy: "2028-11-01" });
  });
  it("reajuste de vivienda", () => {
    expect(housingRentIncrease(30000000, 450)).toMatchObject({ capped: true, maxRentCents: 31350000 });
    expect(housingRentIncrease(30000000, 1500)).toMatchObject({ capped: false, minIfMivahCents: 33000000, maxIfMivahCents: 34500000 });
  });
});

describe("prescripción tributaria", () => {
  it("cuatro años desde el primer día del mes siguiente; diez si no inscrito", () => {
    expect(taxPrescription({ paymentDueOn: "2022-03-15" })).toMatchObject({ from: "2022-04-01", due: "2026-04-01" });
    expect(taxPrescription({ paymentDueOn: "2022-12-15", tenYears: true })).toMatchObject({ from: "2023-01-01", due: "2033-01-01" });
  });
});

import { detectProcedure } from "../src/lib/assistant-reason";
import { parseIntent } from "../src/lib/assistant-intent";
import { parseOtherPrescriptionQuestion } from "../src/lib/otras-materias";

describe("asistente: plazos de las nuevas materias", () => {
  const key = (q: string) => detectProcedure(q)?.key;
  it("reconoce cada trámite", () => {
    expect(key("me pusieron una boleta de tránsito el 20/11/2026, ¿hasta cuándo puedo impugnarla?")).toBe("boleta_transito");
    expect(key("¿cuánto tengo para apelar la resolución de la municipalidad?")).toBe("recurso_administrativo");
    expect(key("plazo para contestar la demanda contencioso administrativa")).toBe("contestacion_contenciosa");
    expect(key("casación en lo contencioso")).toBe("casacion_contenciosa");
    expect(key("¿cuánto tengo para apelar las medidas de protección por violencia doméstica?")).toBe("apelacion_violencia");
    expect(key("plazo para la revocatoria contra la liquidación de oficio de Hacienda")).toBe("revocatoria_tributaria");
  });
  it("no altera los plazos civiles y penales", () => {
    expect(key("plazo para apelar la sentencia")).toBe("apelacion_sentencia");
    expect(key("¿cuánto tengo para apelar la sentencia penal?")).toBe("apelacion_sentencia_penal");
    expect(key("contestar la demanda de divorcio")).toBe("contestacion_familia");
  });
  it("son consultas jurídicas", () => {
    for (const q of ["¿cuándo prescribe una letra de cambio?", "plazo para demandar en lo contencioso", "¿cuánto puede subir el alquiler?", "medidas de protección por violencia doméstica", "¿cómo impugno una boleta?"]) expect(parseIntent(q).kind).toBe("consulta");
  });
});

describe("asistente: prescripción por materia", () => {
  it("comercial, tributaria y tránsito antes que la civil", () => {
    expect(parseOtherPrescriptionQuestion("¿cuándo prescribe una letra de cambio que venció el 10/01/2022?")).toEqual({ area: "comercial", claim: "letra" });
    expect(parseOtherPrescriptionQuestion("prescripción tributaria del IVA")).toEqual({ area: "tributario", tenYears: false });
    expect(parseOtherPrescriptionQuestion("prescripción de impuestos si no estaba inscrito")).toEqual({ area: "tributario", tenYears: true });
    expect(parseOtherPrescriptionQuestion("prescripción de la nulidad de un acuerdo de asamblea de accionistas")).toEqual({ area: "comercial", claim: "nulidad_asamblea" });
    expect(parseOtherPrescriptionQuestion("¿prescribe la multa de tránsito?")).toEqual({ area: "transito" });
    expect(parseOtherPrescriptionQuestion("¿cuándo prescribe una deuda?")).toBeNull();
    expect(parseOtherPrescriptionQuestion("¿cuándo prescribe el delito de estafa?")).toBeNull();
  });
});

import { getTemplate } from "../src/lib/forms/templates";
describe("escritos de las nuevas materias", () => {
  const g = (t: string) => { const i = parseIntent(t); return i.kind === "generar" ? i.template : i.kind; };
  it("el asistente reconoce cada escrito", () => {
    expect(g("genera un recurso de revocatoria contra la resolución de la municipalidad")).toBe("recurso-revocatoria-administrativo");
    expect(g("redacta una demanda contencioso administrativa")).toBe("demanda-contencioso-administrativa");
    expect(g("prepara la impugnación de la boleta de tránsito")).toBe("impugnacion-boleta-transito");
    expect(g("genera una demanda de desahucio")).toBe("demanda-desahucio");
    expect(g("redacta el aviso de no renovación del alquiler")).toBe("aviso-no-renovacion-arrendamiento");
    expect(g("genera una denuncia ante la comisión nacional del consumidor")).toBe("denuncia-consumidor");
    expect(g("redacta el recurso de revocatoria contra la liquidación de oficio de Hacienda")).toBe("recurso-revocatoria-tributario");
    expect(g("genera la solicitud de medidas de protección por violencia doméstica")).toBe("solicitud-medidas-proteccion");
  });
  it("no cambia los escritos existentes", () => {
    expect(g("genera una denuncia penal")).toBe("denuncia-penal");
    expect(g("genera un recurso de revocatoria")).toBe("recurso-revocatoria-apelacion");
    expect(g("redacta una demanda laboral")).toBe("demanda-laboral");
  });
  it("las plantillas se redactan con los datos", () => {
    const b = JSON.stringify(getTemplate("impugnacion-boleta-transito")!.render({ cliente: "Ana Mora", cedula: "1-1111-1111", domicilio: "Escazú", boleta: "2026-123456", fecha_boleta: "2026-11-20", motivos: "No conducía ese día" }));
    expect(b).toContain("COSEVI");
    expect(b).toContain("boleta de citación número 2026-123456");
    expect(b).toContain("artículo 163");
    const d = JSON.stringify(getTemplate("aviso-no-renovacion-arrendamiento")!.render({ cliente: "Luis Rojas", cedula: "2-2222-2222", contraparte: "Marta Solís", inmueble: "Barrio Escalante", entrega: "2023-02-01", vence: "2026-02-01" }));
    expect(d).toContain("NO RENOVAR");
    expect(d).toContain("artículo 71");
  });
});
