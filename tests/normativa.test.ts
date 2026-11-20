import { describe, expect, it } from "vitest";
import { citationText, legalBasis, NORMS, normReference, searchNorms } from "../src/lib/normativa";

describe("normativa: catálogo y búsqueda", () => {
  it("claves únicas y números sin repetir", () => {
    expect(new Set(NORMS.map((n) => n.key)).size).toBe(NORMS.length);
    const nums = NORMS.map((n) => n.number).filter(Boolean);
    expect(new Set(nums).size).toBe(nums.length);
  });
  it("busca por número, «ley N.° …», nombre sin tildes o tema", () => {
    expect(searchNorms("7764").map((n) => n.key)).toEqual(["ley-7764"]);
    expect(searchNorms("Ley N.° 9342")[0].name).toBe("Código Procesal Civil");
    expect(searchNorms("codigo de familia")[0].key).toBe("ley-5476");
    expect(searchNorms("divorcio").map((n) => n.key)).toContain("ley-5476");
    expect(searchNorms("", "laboral").every((n) => n.area === "laboral")).toBe(true);
  });
  it("referencia para pegar en el SCIJ", () => {
    expect(normReference({ name: "Código Notarial", number: "7764" })).toBe("Ley 7764");
    expect(normReference({ name: "Constitución Política", number: null })).toBe("Constitución Política");
  });
});

describe("normativa: citas y fundamento de derecho", () => {
  it("redacta la cita con artículo(s) y la preposición correcta", () => {
    expect(citationText({ normName: "Código Procesal Civil", normNumber: "9342", articles: "35" })).toBe("Artículo 35 del Código Procesal Civil (Ley N.° 9342).");
    expect(citationText({ normName: "Código de Trabajo", normNumber: "2", articles: "28, 29 y 30" })).toBe("Artículos 28, 29 y 30 del Código de Trabajo (Ley N.° 2).");
    expect(citationText({ normName: "Ley de Cobro Judicial", normNumber: "8624", articles: "artículos 1 al 5" })).toBe("Artículos 1 al 5 de la Ley de Cobro Judicial (Ley N.° 8624).");
    expect(citationText({ normName: "Constitución Política de la República de Costa Rica", normNumber: null, articles: "41", note: "acceso a la justicia" })).toBe(
      "Artículo 41 de la Constitución Política de la República de Costa Rica: acceso a la justicia.",
    );
    expect(citationText({ normName: "Voto 2019-01234 de la Sala Primera", normNumber: null, articles: null })).toBe("Voto 2019-01234 de la Sala Primera.");
  });
  it("fundamento de derecho: una cita por línea", () => {
    expect(legalBasis([{ normName: "Código Civil", normNumber: "63", articles: "692" }, { normName: "Código Procesal Civil", normNumber: "9342", articles: "102" }])).toBe(
      "Artículo 692 del Código Civil (Ley N.° 63).\nArtículo 102 del Código Procesal Civil (Ley N.° 9342).",
    );
  });
});

describe("normativa: búsqueda por palabras sueltas", () => {
  it("«codigo trabajo» (sin «de») encuentra el Código de Trabajo", () => {
    expect(searchNorms("codigo trabajo").map((n) => n.key)).toContain("ley-2");
    expect(searchNorms("trabajo codigo")[0].key).toBe("ley-2");
  });
});
