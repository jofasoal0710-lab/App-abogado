import { readFileSync } from "node:fs";
import { join } from "node:path";
import mammoth from "mammoth";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { analyzeDemand, answerValues, emptyAnswers, petitoria, sanitizeAnswers } from "../src/lib/demand-analysis";
import { pointByPoint } from "../src/lib/demand-points";
import { isReadableDemand, rtfToText, sniffDocument } from "../src/lib/doc-text";
import { pendingItems, writingDocx } from "../src/lib/docx-export";
import { ordinalLabel } from "../src/lib/forms/engine";
import { getTemplate } from "../src/lib/forms/templates";
import { insertAt, pendingPositions, phraseGroups } from "../src/lib/writing-phrases";

const text = readFileSync(join(__dirname, "fixtures", "demanda-divorcio.txt"), "utf8");
const a = analyzeDemand(text);
const p = pointByPoint(a, { text, today: "2026-11-26" });

/** Respuestas recomendadas, como si se pulsara «Aplicar las respuestas recomendadas». */
function recommended() {
  const ans = emptyAnswers();
  for (const f of p.facts) {
    const o = f.options.find((x) => x.recommended)!;
    ans.facts[String(f.n)] = { a: o.a, why: o.why };
  }
  for (const c of p.claims) {
    const o = c.options.find((x) => x.recommended)!;
    ans.claims[String(c.n)] = { allanamiento: o.choice === "allano", parcial: o.choice === "parcial", why: o.why };
  }
  return sanitizeAnswers(JSON.parse(JSON.stringify(ans)), a);
}

describe("contestación lista para presentar", () => {
  const tpl = getTemplate("contestacion-demanda")!;
  const values = { juzgado: "Juzgado de Familia de Liberia", cliente: "Ana Lucía Soto Rojas", cedula: "5-0000-0002", estadoCivil: "casada", profesion: "comerciante", domicilio: "Liberia", contraparte: "Pedro Luis Mora Vargas", notificaciones: "correo@example.test", abogado: "Lucía Fernández", carne: "12345", lugar: "Liberia", fecha: "2026-11-27", ...answerValues(a, recommended()) };
  const blocks = tpl.render(values);

  it("los hechos van «AL HECHO PRIMERO», sin excepciones vacías y con petitoria coherente", () => {
    const hechos = blocks.find((b) => b.t === "ordinales" && b.prefix === "AL HECHO");
    expect(hechos && hechos.t === "ordinales" && hechos.items).toHaveLength(5);
    expect(blocks.some((b) => b.t === "seccion" && b.text === "EXCEPCIONES")).toBe(false);
    const pet = blocks[blocks.findIndex((b) => b.t === "seccion" && b.text === "PETITORIA") + 1];
    expect(pet.t).toBe("ordinales");
    const petText = pet.t === "ordinales" ? pet.items.join(" ") : "";
    expect(petText).toMatch(/allanamiento a las pretensiones 2, 3, 4, 5, 6 y 7/);
    expect(petText).toMatch(/sin especial condena en costas/);
    expect(petText).not.toMatch(/sin lugar la demanda en todos sus extremos/);
    expect(ordinalLabel(0, "AL HECHO")).toBe("AL HECHO PRIMERO");
  });

  it("genera un .docx válido: carta, Times 12, pie con páginas y pendientes resaltados", async () => {
    const bytes = writingDocx("Contestación", blocks, { author: "Lucía" });
    const zip = new PizZip(bytes);
    const doc = zip.file("word/document.xml")!.asText();
    expect(doc).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
    expect(doc).toContain('w:highlight w:val="yellow"');
    expect(zip.file("word/styles.xml")!.asText()).toContain('w:ascii="Times New Roman"');
    expect(zip.file("word/footer1.xml")!.asText()).toContain("NUMPAGES");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    expect(value).toMatch(/SEÑOR\(A\) JUEZ\(A\) DEL JUZGADO DE FAMILIA DE LIBERIA/);
    expect(value).toMatch(/AL HECHO PRIMERO: Lo admito como cierto\. Consta en la certificación de matrimonio/);
    expect(value).toMatch(/AL HECHO CUARTO: No es un hecho, sino una apreciación jurídica/);
    expect(value).toMatch(/Carné del Colegio de Abogados 12345/);
  });

  it("escapa caracteres especiales y quita los de control", async () => {
    const bytes = writingDocx("A & B <x>", [{ t: "p", text: "Monto: ₡1 < ₡2 & «comillas» \u0007fin" }]);
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    expect(value.trim()).toBe("Monto: ₡1 < ₡2 & «comillas» fin");
  });

  it("lista lo que falta por completar antes de presentar", () => {
    const items = pendingItems(blocks);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => /Sobre los hechos · al hecho tercero/.test(i.section))).toBe(true);
    expect(pendingItems([{ t: "p", text: "Todo completo." }])).toEqual([]);
    expect(pendingItems([{ t: "p", text: "Vecino de ________, casado, ________." }]).map((i) => i.text)).toEqual(["Dato en blanco: «…Vecino de ________»", "Dato en blanco: «…casado, ________»"]);
  });

  it("petitoria: oposición total pide sin lugar y costas", () => {
    expect(petitoria(a, emptyAnswers(), true)).toEqual([
      "Que se tenga por contestada en tiempo y forma la demanda, en los términos expuestos.",
      "Que se acojan las excepciones opuestas.",
      "Que se declare sin lugar la demanda en todos sus extremos.",
      "Que se condene a la parte actora al pago de ambas costas del proceso.",
    ]);
  });
});

describe("formatos de la demanda", () => {
  it("reconoce el formato por el contenido", () => {
    expect(sniffDocument(Buffer.from("%PDF-1.7 ..."), "application/octet-stream")).toBe("pdf");
    expect(sniffDocument(Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]), "")).toBe("docx");
    expect(sniffDocument(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]), "application/msword")).toBe("doc");
    expect(sniffDocument(Buffer.from("{\\rtf1\\ansi hola}"), "")).toBe("rtf");
    expect(sniffDocument(Buffer.from("hola"), "text/plain")).toBe("txt");
    expect(sniffDocument(Buffer.from("hola"), "image/png")).toBeNull();
  });
  it("lista los .doc antiguos como demandas legibles", () => {
    expect(isReadableDemand("DEMANDA DE DIVORCIO.doc", "application/msword")).toBe(true);
    expect(isReadableDemand("demanda.doc", "application/octet-stream")).toBe(true);
    expect(isReadableDemand("demanda.rtf", "")).toBe(true);
    expect(isReadableDemand("foto.jpg", "image/jpeg")).toBe(false);
  });
  it("lee RTF con tildes, eñes y Unicode", () => {
    const rtf = "{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}{\\*\\generator Word;}\\f0 HECHOS:\\par PRIMERO: Contraje matrimonio en Ca\\'f1as, Guanacaste.\\par SEGUNDO: Acci\\u243?n de divorcio.}";
    expect(rtfToText(rtf)).toBe("HECHOS:\nPRIMERO: Contraje matrimonio en Cañas, Guanacaste.\nSEGUNDO: Acción de divorcio.");
  });
});

describe("ayuda para escribir", () => {
  it("inserta en el cursor con espacios", () => {
    expect(insertAt("Es cierto.", 10, 10, "Asimismo, ")).toEqual({ value: "Es cierto. Asimismo, ", caret: 21 });
    expect(insertAt("AB", 1, 1, "x")).toEqual({ value: "A x B", caret: 3 });
    expect(insertAt("", 0, 0, "Es cierto.")).toEqual({ value: "Es cierto.", caret: 10 });
    expect(insertAt("cambiar ESTO aquí", 8, 12, "esto")).toEqual({ value: "cambiar esto aquí", caret: 12 });
  });
  it("encuentra los pendientes", () => {
    expect(pendingPositions("a [PENDIENTE] b [PENDIENTE: x]")).toEqual([
      { index: 2, length: 11, text: "[PENDIENTE]" },
      { index: 16, length: 14, text: "[PENDIENTE: x]" },
    ]);
  });
  it("frases con el género de la clientela", () => {
    const f = phraseGroups({ female: true }).flatMap((g) => g.phrases.map((x) => x.text)).join(" ");
    const m = phraseGroups({ female: false }).flatMap((g) => g.phrases.map((x) => x.text)).join(" ");
    expect(f).toMatch(/mi representada/);
    expect(m).toMatch(/mi representado/);
    expect(m).not.toMatch(/mi representada/);
  });
});

describe("Word 97-2003 (.doc)", () => {
  it("lee un .doc y lo analiza igual que el texto", async () => {
    const WordExtractor = (await import("word-extractor")).default;
    const buf = readFileSync(join(__dirname, "fixtures", "demanda-divorcio.doc"));
    expect(sniffDocument(buf, "application/msword")).toBe("doc");
    const body = (await new WordExtractor().extract(buf)).getBody();
    const d = analyzeDemand(body);
    expect(d.plaintiffs).toEqual(["Pedro Luis Mora Vargas"]);
    expect(d.defendants).toEqual(["Ana Lucía Soto Rojas"]);
    expect([d.facts.length, d.claims.length, d.evidence.length]).toEqual([5, 9, 7]);
  });
});
