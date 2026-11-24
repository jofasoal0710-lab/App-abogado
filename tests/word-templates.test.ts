import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { inspectTemplate, longDate, outputName, renderTemplate, TemplateError } from "../src/lib/word-templates";

/** .docx mínimo con los párrafos dados (cada párrafo, una lista de «runs» de texto). */
function docx(paragraphs: string[][], extra: Record<string, string> = {}): Buffer {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paragraphs.map((runs) => `<w:p>${runs.map((t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join("")}</w:p>`).join("");
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  for (const [k, v] of Object.entries(extra)) zip.file(k, v);
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}
const text = (buf: Buffer) => new PizZip(buf).file("word/document.xml")!.asText().replace(/<[^>]+>/g, "");

describe("plantillas Word", () => {
  it("detecta los campos en orden, también si Word los partió en varios trozos", () => {
    const b = docx([["Yo, {cliente}, cédula {cliente_", "cedula}"], ["Expediente {expediente} — {fecha_audiencia} {cliente}"]]);
    expect(inspectTemplate(b)).toEqual(["cliente", "cliente_cedula", "expediente", "fecha_audiencia"]);
  });
  it("rellena los campos, escapa el XML y deja vacíos los que faltan", () => {
    const b = docx([["Señor/a {cliente} <{cliente_cedula}> {sin_valor}."]].map((p) => p.map((t) => t.replace("<", "&lt;").replace(">", "&gt;"))));
    const out = renderTemplate(b, { cliente: "Ana & Cía <S.A.>", cliente_cedula: "1-0234-0567" });
    const xml = new PizZip(out).file("word/document.xml")!.asText();
    expect(xml).toContain("Ana &amp; Cía &lt;S.A.&gt;");
    expect(text(out)).toContain("Señor/a Ana &amp; Cía &lt;S.A.&gt; &lt;1-0234-0567&gt; .");
  });
  it("saltos de línea en un valor", () => {
    const out = renderTemplate(docx([["{direccion}"]]), { direccion: "San José\nCalle 5" });
    expect(new PizZip(out).file("word/document.xml")!.asText()).toContain("<w:br/>");
  });
  it("rechaza expresiones (solo nombres simples) y llaves sin cerrar", () => {
    expect(() => inspectTemplate(docx([["{cliente.constructor}"]]))).toThrow(TemplateError);
    expect(() => inspectTemplate(docx([["{fecha de hoy}"]]))).toThrow(/no es válido/);
    expect(() => inspectTemplate(docx([["Hola {cliente"]]))).toThrow(/llave/);
  });
  it("rechaza lo que no es un .docx y los documentos con macros", () => {
    expect(() => inspectTemplate(Buffer.from("no soy un zip"))).toThrow(/no es un documento de Word/);
    const z = new PizZip(); z.file("hola.txt", "x");
    expect(() => inspectTemplate(z.generate({ type: "nodebuffer" }) as Buffer)).toThrow(/no es un documento de Word/);
    expect(() => inspectTemplate(docx([["{cliente}"]], { "word/vbaProject.bin": "x" }))).toThrow(/macros/);
  });
  it("fecha en letras (setiembre) y nombre del archivo generado", () => {
    expect(longDate("2026-09-05")).toBe("5 de setiembre de 2026");
    expect(outputName('Poder: "especial"/judicial', "EXP-2026-0001")).toBe("Poder especial judicial - EXP-2026-0001.docx");
  });
});
