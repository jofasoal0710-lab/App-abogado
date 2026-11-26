import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeDemand, answerValues, emptyAnswers, findCitations, observations, sanitizeAnswers } from "../src/lib/demand-analysis";
import { classifyAssertion, controversyOf, pointByPoint, splitAssertions, splitTitle } from "../src/lib/demand-points";

const text = readFileSync(join(__dirname, "fixtures", "demanda-divorcio.txt"), "utf8");
const a = analyzeDemand(text);
const p = pointByPoint(a, { text, today: "2026-11-26" });
const fact = (n: number) => p.facts.find((f) => f.n === n)!;
const claim = (topic: string) => p.claims.find((c) => c.topic === topic)!;
const rec = <T extends { recommended?: boolean }>(xs: T[]) => xs.find((x) => x.recommended)!;

describe("lectura de una demanda de divorcio", () => {
  it("reconoce partes, juzgado y que aún no hay número de expediente", () => {
    expect(a.plaintiffs).toEqual(["Pedro Luis Mora Vargas"]);
    expect(a.defendants).toEqual(["Ana Lucía Soto Rojas"]);
    expect(a.court).toBe("JUZGADO DE FAMILIA DE LIBERIA");
    // El 23-000111-1570-VD es de las medidas de protección, no de esta demanda.
    expect(a.caseNumber).toBeNull();
    expect(a.process).toBe("familia");
    expect(a.filedOn).toBe("2024-09-09");
    expect(a.procedureLaw).toMatch(/7130/);
  });

  it("separa hechos, pretensiones (sin el preámbulo) y prueba por apartados", () => {
    expect(a.facts).toHaveLength(5);
    expect(a.claims).toHaveLength(9);
    expect(a.claims[0].text).toMatch(/^De la demanda/);
    expect(a.evidence.map((e) => e.kind)).toEqual(["testimonial", "testimonial", "documental", "documental", "documental", "documental", "declaracion_parte"]);
    expect(a.evidence[0].text).toMatch(/^Rosa María Vargas Castro/);
  });

  it("cita el CPC anterior (Ley 7130) y no lo confunde con el vigente; ignora «inciso» y «párrafo»", () => {
    const cites = findCitations(text);
    expect(cites.find((c) => c.normKey === "ley-7130")?.articles).toEqual(["420"]);
    expect(cites.find((c) => c.normKey === "ley-5476")?.articles).toEqual(expect.arrayContaining(["41", "48", "151", "152"]));
    expect(cites.some((c) => c.normKey === "ley-9342")).toBe(false);
  });

  it("no confunde a la clienta demandada con la parte actora y avisa del régimen procesal", () => {
    const obs = observations(a, { clientName: "Ana Lucía Soto Rojas", today: "2026-11-26" });
    expect(obs.some((o) => /ACTORA/.test(o.text))).toBe(false);
    expect(obs.some((o) => /Ley N\.º 7130/.test(o.text))).toBe(true);
    expect(obs.some((o) => /declaración de parte/.test(o.text))).toBe(true);
  });
});

describe("análisis punto por punto de los hechos", () => {
  it("clasifica la controversia de cada hecho", () => {
    expect(p.summary.sin_controversia).toEqual([1, 2]);
    expect(fact(3).controversy).toBe("parcial");
    expect(fact(4).controversy).toBe("no_es_hecho");
    expect(fact(5).controversy).toBe("parcial");
    expect(p.clientRole).toEqual({ female: true, parent: true });
  });

  it("matrimonio e hijo: admitir, apoyándose en la certificación", () => {
    expect(rec(fact(1).options)).toMatchObject({ a: "admito", why: expect.stringMatching(/certificación de matrimonio/) });
    expect(rec(fact(2).options)).toMatchObject({ a: "admito", why: expect.stringMatching(/certificación de nacimiento/) });
    expect(fact(1).title).toBe("Del Matrimonio");
  });

  it("hecho mixto: admite lo objetivo, rechaza imputaciones y valoraciones, no admite montos", () => {
    const f3 = fact(3);
    const natures = new Set(f3.assertions.map((s) => s.nature));
    for (const n of ["imputacion", "valorativo", "patrimonial", "convivencia"] as const) expect(natures.has(n)).toBe(true);
    const o = rec(f3.options);
    expect(o.a).toBe("variantes");
    expect(o.why).toMatch(/Se admite que las partes contrajeron matrimonio en 2010/);
    expect(o.why).toMatch(/se encuentran separadas \(el actor lo sitúa desde octubre de 2023\)/);
    expect(o.why).toMatch(/No es cierto que mi representada haya incurrido/);
    expect(o.why).toMatch(/apreciaciones subjetivas/);
    expect(o.why).toMatch(/No se admiten los montos/);
    expect(o.why).toMatch(/\[PENDIENTE: confirmar con la clienta/);
    expect(f3.options.map((x) => x.a)).toEqual(expect.arrayContaining(["rechazo", "admito"]));
    expect(f3.hints.join(" ")).toMatch(/23-000111-1570-VD/);
    expect(f3.hints.join(" ")).toMatch(/cinco millones de colones/);
    expect(f3.hints.join(" ")).toMatch(/CF art\. 48, inciso 8/);
    // «poco más de 20 años», pero de 2010 a 2024 van 14.
    expect(f3.hints.join(" ")).toMatch(/hay 14 años/);
  });

  it("la causal es fundamento jurídico, con la alternativa de admitir la incompatibilidad sin culpas", () => {
    const f4 = fact(4);
    expect(rec(f4.options).a).toBe("no_hecho");
    expect(f4.options.find((o) => o.a === "variantes")?.why).toMatch(/incompatibilidad de caracteres que impide la vida en común/);
  });

  it("bienes: admite la finca, discute los aportes y avisa del bono de vivienda", () => {
    const o = rec(fact(5).options);
    expect(o.why).toMatch(/finca matrícula 123456-000/);
    expect(o.why).toMatch(/recursos propios del actor/);
    expect(o.why).not.toMatch(/Mide:/);
    expect(fact(5).hints.join(" ")).toMatch(/Ley 7052/);
    expect(fact(5).hints.join(" ")).toMatch(/mitad de su valor neto \(CF art\. 41\)/);
  });
});

describe("pretensiones y prueba", () => {
  it("valora cada pretensión desde el lado de la demandada", () => {
    expect(p.claims.map((c) => c.topic)).toEqual(["Con lugar la demanda", "Divorcio", "Bienes gananciales", "Alimentos entre las partes", "Responsabilidad parental", "Guarda, crianza y educación", "Alimentos para el hijo o hija", "Régimen de interrelación familiar", "Costas"]);
    expect(claim("Bienes gananciales").stance).toBe("favorable");
    expect(claim("Guarda, crianza y educación").stance).toBe("favorable");
    expect(claim("Costas").stance).toBe("desfavorable");
    expect(rec(claim("Divorcio").options)).toMatchObject({ choice: "allano", why: expect.stringMatching(/sin que ello implique aceptar los hechos/) });
    expect(rec(claim("Alimentos para el hijo o hija").options).why).toMatch(/23-000222-0404-PA/);
    expect(claim("Régimen de interrelación familiar").hints.join(" ")).toMatch(/2024, ya pasadas/);
  });

  it("advierte del posible parentesco de los testigos y de la prueba genérica", () => {
    const e1 = p.evidence.find((e) => e.n === 1)!;
    expect(e1.hints[0].text).toMatch(/comparte apellido con el actor/);
    expect(p.evidence.find((e) => e.n === 2)!.hints[0].text).toMatch(/comparte apellidos/);
    expect(e1.hints.some((h) => /sobre todos los hechos/.test(h.text))).toBe(true);
    expect(p.evidence.find((e) => e.n === 6)!.hints[0].text).toMatch(/medidas de protección/);
  });

  it("las respuestas recomendadas producen un escrito coherente", () => {
    const ans = emptyAnswers();
    for (const f of p.facts) {
      const o = rec(f.options);
      ans.facts[String(f.n)] = { a: o.a, why: o.why };
    }
    for (const c of p.claims) {
      const o = rec(c.options);
      ans.claims[String(c.n)] = { allanamiento: o.choice === "allano", parcial: o.choice === "parcial", why: o.why };
    }
    const clean = sanitizeAnswers(JSON.parse(JSON.stringify(ans)), a);
    expect(clean.facts["4"].a).toBe("no_hecho");
    expect(clean.claims["1"].parcial).toBe(true);
    const v = answerValues(a, clean);
    const lines = v.hechos.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Lo admito como cierto. Consta en la certificación de matrimonio aportada por la parte actora.");
    expect(lines[3]).toMatch(/^No es un hecho, sino una apreciación jurídica: /);
    const claims = v.pretensiones.split("\n");
    expect(claims[1]).toMatch(/^En cuanto a la pretensión 2: Me allano a que se decrete el divorcio/);
    expect(claims.every((l) => !/Me allano a la pretensión \d+\. Me allano/.test(l))).toBe(true);
  });
});

describe("piezas sueltas", () => {
  it("título del hecho", () => {
    expect(splitTitle("De los hijos: Fruto de nuestro matrimonio…")).toEqual({ title: "De los hijos", body: "Fruto de nuestro matrimonio…" });
    expect(splitTitle("El demandado no pagó el 5 de mayo.").title).toBeNull();
  });
  it("afirmaciones y su naturaleza", () => {
    expect(splitAssertions("Firmamos el contrato. No obstante, el demandado nunca pagó lo pactado en la cláusula tercera.")).toHaveLength(2);
    expect(classifyAssertion("Contraje matrimonio el 1 de enero de 2000, inscrito en el Registro Civil al Tomo 1, Folio 2, Asiento 3").nature).toBe("registral");
    expect(classifyAssertion("Me agredió verbalmente en varias ocasiones").nature).toBe("imputacion");
    expect(classifyAssertion("Mediante Ley Nº 9823 se reformó el artículo 48 del Código de Familia").nature).toBe("juridico");
    expect(classifyAssertion("La relación se tornó insoportable").nature).toBe("valorativo");
  });
  it("controversia por combinación", () => {
    const as = (xs: string[]) => xs.map(classifyAssertion);
    expect(controversyOf(as(["Nació el 1 de enero de 2010, inscrito en el Registro Civil al Tomo 1"]))).toBe("sin_controversia");
    expect(controversyOf(as(["La relación se tornó insoportable"]))).toBe("controvertido");
    expect(controversyOf(as(["Vivimos juntos en Heredia durante cinco años"]))).toBe("confirmar");
    expect(controversyOf([])).toBe("confirmar");
  });
  it("una demanda laboral sencilla también recibe opciones", () => {
    const lab = analyzeDemand("HECHOS:\nPRIMERO: Laboré para la demandada desde el 1 de enero de 2020 como bodeguero.\nSEGUNDO: El patrono me despidió sin justa causa y me gritó frente a mis compañeros.\nPRETENSIONES:\n1.- Que se condene al pago de preaviso y cesantía.\n2.- Ambas costas.");
    const lp = pointByPoint(lab, { text: "", today: "2026-11-26" });
    expect(lp.facts).toHaveLength(2);
    expect(lp.facts.every((f) => f.options.length >= 2 && f.options.some((o) => o.recommended))).toBe(true);
    expect(lp.claims.find((c) => c.topic === "Costas")).toBeTruthy();
  });
});
