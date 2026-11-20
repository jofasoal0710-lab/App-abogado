import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkText } from "../src/lib/spellcheck";
import { accentVariants, styleIssues } from "../src/lib/text-rules";

describe("revisión de estilo", () => {
  it("palabras repetidas, espacios y puntuación", () => {
    const kinds = (t: string) => styleIssues(t).map((i) => i.kind);
    expect(kinds("Solicito que que se admita.")).toContain("repeticion");
    expect(kinds("Solicito  que se admita.")).toContain("espacios");
    expect(kinds("Solicito que se admita , por favor.")).toContain("espacios");
    expect(kinds("Primero,segundo.")).toContain("puntuacion");
    expect(kinds("Se admite.Luego se resuelve.")).toContain("puntuacion");
    expect(kinds("Se admite. luego se resuelve.")).toContain("mayuscula");
    expect(kinds("Conforme al art. 29 del Código.")).toEqual([]);
    expect(kinds("Ley N.° 9342 y Lic. Pérez, S.A. Comercial.")).toEqual([]);
    expect(kinds("Monto de ₡1.500.000,00 según el inc. b).")).toEqual([]);
  });
  it("signos sin cerrar y huecos por completar", () => {
    expect(styleIssues("Según el (artículo 29").map((i) => i.kind)).toContain("signos");
    expect(styleIssues("Qué dice?").map((i) => i.kind)).toContain("signos");
    expect(styleIssues("El monto es ____ colones.").map((i) => i.kind)).toContain("vacio");
  });
  it("variantes con tilde", () => {
    expect(accentVariants("habia")).toContain("había");
    expect(accentVariants("ano")).toContain("año");
  });
});

describe("ortografía con diccionario (en el servidor)", () => {
  it("detecta faltas y propone la palabra con tilde primero", async () => {
    const issues = await checkText("El trabajador habia laborado sin preaviso y se le nego la cesantia.");
    const words = issues.filter((i) => i.kind === "ortografia").map((i) => [i.word, i.suggestions?.[0]]);
    expect(words).toEqual([
      ["habia", "había"],
      ["nego", "negó"],
      ["cesantia", "cesantía"],
    ]);
  }, 20_000);
  it("no marca nombres propios, siglas, latinismos ni términos jurídicos", async () => {
    const issues = await checkText("Gerson Villalobos, cédula 1-1111-1111, demanda a la CCSS en el Juzgado nº 12 y la 2ª instancia. Notifíquese al correo ana@bufete.cr. Litisconsorcio ad hoc; téngase por contestada.");
    expect(issues).toEqual([]);
  }, 20_000);
});
