import { describe, expect, it } from "vitest";
import { BLANK, cleanValues, initialValues, lines, longDate, missingRequired, toPlainText } from "../src/lib/forms/engine";
import { getTemplate, TEMPLATES } from "../src/lib/forms/templates";

describe("formularios", () => {
  it("hechos: una línea por hecho, sin numeración previa ni vacías", () => {
    expect(lines({ h: "1. Primero\n\n- Segundo\n3) Tercero " }, "h")).toEqual(["Primero", "Segundo", "Tercero"]);
  });
  it("fecha en letras con «setiembre» (uso costarricense)", () => {
    expect(longDate("2026-09-05")).toBe("5 de setiembre de 2026");
  });
  it("los campos vacíos salen como línea en blanco, nunca como el nombre del campo", () => {
    const t = getTemplate("demanda-ordinaria-civil")!;
    const text = toPlainText(t.render({}));
    expect(text).toContain(BLANK);
    expect(text).not.toMatch(/\{\{|undefined|null/);
  });
  it("los hechos se numeran PRIMERO, SEGUNDO…", () => {
    const t = getTemplate("demanda-ordinaria-civil")!;
    const text = toPlainText(t.render({ hechos: "Firmamos contrato\nNo pagó" }));
    expect(text).toContain("PRIMERO: Firmamos contrato");
    expect(text).toContain("SEGUNDO: No pagó");
  });
  it("los escritos de abogado no llevan tomo, folio, asiento ni «otorga»; las escrituras sí llevan protocolo", () => {
    for (const t of TEMPLATES) {
      const text = toPlainText(t.render({})).toLowerCase();
      if (t.kind === "escrito") expect(text).not.toMatch(/\btomo\b|\bfolio\b|\basiento\b|otorga/);
      else expect(text).toMatch(/tomo/);
      expect(t.fields.map((f) => f.name).length).toBe(new Set(t.fields.map((f) => f.name)).size);
    }
  });
  it("valores iniciales: guardados > automáticos; limpieza y obligatorios", () => {
    const t = getTemplate("senalamiento-medio")!;
    expect(initialValues(t, { "cliente.nombre": "Ana" }).cliente).toBe("Ana");
    expect(initialValues(t, { "cliente.nombre": "Ana" }, { cliente: "Bea" }).cliente).toBe("Bea");
    const clean = cleanValues(t, { cliente: "Ana", hack: "x", juzgado: 5 });
    expect(clean.hack).toBeUndefined();
    expect(clean.juzgado).toBe("");
    expect(missingRequired(t, clean)).toContain("Despacho judicial");
  });
});
