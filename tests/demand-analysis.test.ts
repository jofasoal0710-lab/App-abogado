import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeDemand, answerValues, defensesFor, detectProcess, emptyAnswers, findAmounts, findCitations, findDates, headingOf, observations, parseMoney, sameParty, sanitizeAnswers, splitItems } from "../src/lib/demand-analysis";

const laboral = readFileSync(new URL("./fixtures/demanda-laboral.txt", import.meta.url), "utf8");

describe("demanda laboral de ejemplo", () => {
  const a = analyzeDemand(laboral);
  it("reconoce el proceso, el juzgado y el expediente judicial", () => {
    expect(a.process).toBe("laboral");
    expect(a.court).toMatch(/JUZGADO DE TRABAJO DEL PRIMER CIRCUITO/);
    expect(a.caseNumber).toBe("26-001234-0166-LA");
  });
  it("identifica a las partes", () => {
    expect(a.plaintiffs).toEqual(["María Fernanda Solano Rojas"]);
    expect(a.defendants[0]).toBe("Inversiones Gastronómicas del Valle S.A.");
  });
  it("separa los cinco hechos, cuatro pretensiones y tres pruebas", () => {
    expect(a.facts.map((f) => f.n)).toEqual([1, 2, 3, 4, 5]);
    expect(a.facts[0].text).toMatch(/^Ingresé a laborar/);
    expect(a.facts[3].text).toMatch(/despedida verbalmente/);
    expect(a.claims).toHaveLength(4);
    expect(a.evidence.map((e) => e.kind)).toEqual(["documental", "testimonial", "declaracion_parte"]);
  });
  it("montos, estimación y fechas", () => {
    expect(a.estimate?.value).toBe(2_550_000);
    expect(a.claimAmounts.map((x) => x.value)).toEqual([450_000, 2_100_000]);
    expect(a.dates).toEqual(["2019-02-03", "2025-08-15"]);
  });
  it("leyes citadas, agrupadas por ley", () => {
    const ct = a.citations.find((c) => c.normKey === "ley-2");
    expect(ct?.articles).toEqual(["28", "29", "30", "153", "9999"]);
    expect(a.citations.find((c) => c.normKey === "constitucion")?.articles).toEqual(["56"]);
  });
  it("observaciones: plazo, hecho compuesto, despido, prescripción y cita inexistente", () => {
    const obs = observations(a, { clientName: "Inversiones Gastronómicas del Valle, Sociedad Anónima", today: "2026-11-25", missingArticles: [{ law: "Código de Trabajo", articles: ["9999"] }] });
    const all = obs.map((o) => o.text).join("\n");
    expect(all).toMatch(/10 días hábiles/);
    expect(obs.find((o) => o.ref === "Código de Trabajo art. 497")).toBeTruthy();
    expect(all).toMatch(/carta de despido/);
    expect(all).toMatch(/hace 7 años/);
    expect(all).toMatch(/art\. 9999 del Código de Trabajo/);
    expect(all).not.toMatch(/aparece como parte ACTORA/);
  });
  it("avisa si nuestro cliente es el actor", () => {
    const obs = observations(a, { clientName: "María Solano Rojas", today: "2026-11-25" });
    expect(obs[0].level === "info" && obs.some((o) => /parte ACTORA/.test(o.text))).toBe(true);
  });
  it("genera los valores de la contestación en el orden de los hechos", () => {
    const ans = sanitizeAnswers(
      {
        facts: { "1": { a: "variantes", why: "Ingresó el 3 de marzo de 2019, no en febrero" }, "3": { a: "admito" }, "4": { a: "rechazo", why: "Renunció voluntariamente, según su carta del 14 de agosto" }, "99": { a: "admito" } },
        claims: { "4": { allanamiento: false, why: "No procede la condena en costas" } },
        defenses: { prescripcion: { on: true, why: "Ha transcurrido el plazo" }, inventada: { on: true } },
        ownEvidence: "Carta de renuncia",
        process: "laboral",
      },
      a,
    );
    expect(Object.keys(ans.facts)).toEqual(["1", "3", "4"]);
    const v = answerValues(a, ans);
    const hechos = v.hechos.split("\n");
    expect(hechos).toHaveLength(5);
    expect(hechos[0]).toBe("Lo admito con variantes o rectificaciones: Ingresó el 3 de marzo de 2019, no en febrero.");
    expect(hechos[1]).toMatch(/PENDIENTE/);
    expect(hechos[2]).toBe("Lo admito como cierto.");
    expect(hechos[3]).toMatch(/^Lo rechazo por inexacto: Renunció/);
    expect(v.excepciones).toBe("Excepción de prescripción (CT art. 504): Ha transcurrido el plazo.");
    expect(v.pretensiones.split("\n")[3]).toBe("Me opongo a la pretensión 4: No procede la condena en costas.");
    expect(v.tipoProceso).toBe("Ordinario laboral");
  });
});

describe("piezas", () => {
  it("títulos de sección con distintos formatos", () => {
    expect(headingOf("III.- HECHOS:")).toBe("hechos");
    expect(headingOf("Hechos:")).toBe("hechos");
    expect(headingOf("RELACIÓN DE HECHOS")).toBe("hechos");
    expect(headingOf("PETITORIA")).toBe("pretensiones");
    expect(headingOf("FUNDAMENTOS DE DERECHO")).toBe("fundamentos");
    expect(headingOf("OFRECIMIENTO DE PRUEBA")).toBe("prueba");
    expect(headingOf("Los hechos ocurrieron así y por eso demando")).toBeNull();
  });
  it("enumeraciones: 1.-, Hecho segundo:, a), y párrafos sin numerar", () => {
    expect(splitItems("1.- Uno es esto.\n2.- Dos es aquello\nque sigue.\n3) Tres.")).toEqual(["Uno es esto.", "Dos es aquello que sigue.", "Tres."]);
    expect(splitItems("Hecho primero: El contrato se firmó.\nHecho segundo: No pagó.")).toEqual(["El contrato se firmó.", "No pagó."]);
    expect(splitItems("Un párrafo largo de hechos sin número.\n\nOtro párrafo distinto con más texto.")).toHaveLength(2);
  });
  it("un número decimal o un año al inicio no es una marca", () => {
    expect(splitItems("1. Primero.\n2024 fue el año en que pasó.\n2. Segundo.")).toEqual(["Primero. 2024 fue el año en que pasó.", "Segundo."]);
  });
  it("montos en formato costarricense y en dólares", () => {
    expect(parseMoney("₡1.250.000,00")).toBe(1_250_000);
    expect(parseMoney("₡ 350 000")).toBe(350_000);
    expect(parseMoney("$3,500.50")).toBe(3500.5);
    expect(findAmounts("pagar ₡450.000,00 y US$1,200.00").map((x) => x.currency)).toEqual(["CRC", "USD"]);
  });
  it("fechas en letras y numéricas", () => {
    expect(findDates("el 5 de setiembre de 2024 y el 01/02/2023")).toEqual(["2023-02-01", "2024-09-05"]);
  });
  it("citas: abreviaturas, rangos y leyes por número", () => {
    expect(findCitations("art. 35 del CPC")[0]).toMatchObject({ normKey: "ley-9342", articles: ["35"] });
    expect(findCitations("artículos 31 al 33 de la Ley N.º 7527")[0]).toMatchObject({ normKey: "ley-7527", articles: ["31", "32", "33"] });
    expect(findCitations("numeral 1045 del Código Civil")[0]).toMatchObject({ normKey: "ley-63", articles: ["1045"] });
  });
  it("tipo de proceso", () => {
    expect(detectProcess("PROCESO MONITORIO DINERARIO").kind).toBe("monitorio");
    expect(detectProcess("Demanda de divorcio por causal").kind).toBe("familia");
    expect(detectProcess("Proceso sumario de desahucio").kind).toBe("sumario_civil");
    expect(detectProcess("Proceso ordinario civil de daños").kind).toBe("ordinario_civil");
  });
  it("excepciones procesales civiles: solo las cinco del art. 37.3 CPC", () => {
    expect(defensesFor("ordinario_civil").filter((d) => d.kind === "procesal")).toHaveLength(5);
    expect(defensesFor("laboral").filter((d) => d.kind === "procesal").map((d) => d.ref)).toEqual(["CT art. 437", "CT art. 440"]);
  });
  it("misma parte con o sin «S.A.» y tildes", () => {
    expect(sameParty("Inversiones del Valle S.A.", "INVERSIONES DEL VALLE SOCIEDAD ANONIMA")).toBe(true);
    expect(sameParty("Ana Mora", "Juan Mora")).toBe(false);
  });
  it("respuestas vacías: todo pendiente", () => {
    const a = analyzeDemand(laboral);
    expect(answerValues(a, emptyAnswers()).hechos.split("\n").every((l) => /PENDIENTE/.test(l))).toBe(true);
  });
});
