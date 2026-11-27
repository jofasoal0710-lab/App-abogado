/**
 * Escrito en Word de verdad (.docx, Office Open XML), listo para revisar, firmar y presentar:
 * tamaño carta, márgenes de 2,5 cm, Times New Roman 12, interlineado 1,5, párrafos justificados,
 * numeración «Página X de Y» al pie y los [PENDIENTE…] resaltados en amarillo para encontrarlos.
 *
 * Se arma a mano con PizZip (ya está en el proyecto por las plantillas Word): sin dependencias nuevas.
 */
import PizZip from "pizzip";
import { BLANK, ordinalLabel, type Block } from "./forms/engine";

/** Texto válido para XML: escapado y sin caracteres de control. */
const x = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Run = { text: string; bold?: boolean; plain?: boolean };

/** Divide el texto para resaltar los pendientes («[PENDIENTE: …]») y las líneas en blanco («________»). */
function runs(text: string, bold = false, plain = false): string {
  const parts = plain ? [text] : text.split(/(\[PENDIENTE[^\]]*\]|_{6,})/);
  return parts
    .filter((p) => p !== "")
    .map((p) => {
      const pending = /^\[PENDIENTE/.test(p) || /^_{6,}$/.test(p);
      const rPr = `${bold || pending ? "<w:b/>" : ""}${pending ? '<w:highlight w:val="yellow"/>' : ""}`;
      return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${x(p)}</w:t></w:r>`;
    })
    .join("");
}

function para(content: Run[], opts: { align?: "both" | "center" | "left"; before?: number; after?: number; keepNext?: boolean } = {}): string {
  const pPr = [
    opts.keepNext ? "<w:keepNext/>" : "",
    `<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 160}" w:line="360" w:lineRule="auto"/>`,
    `<w:jc w:val="${opts.align ?? "both"}"/>`,
  ].join("");
  return `<w:p><w:pPr>${pPr}</w:pPr>${content.map((r) => runs(r.text, r.bold, r.plain)).join("")}</w:p>`;
}

/** Cuerpo del documento a partir de los bloques del formulario. */
export function blocksToDocxBody(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "titulo":
        out.push(para([{ text: b.text, bold: true }], { align: "center", after: 240 }));
        break;
      case "encabezado":
        out.push(para([{ text: b.text, bold: true }], { align: "left", after: 0 }));
        break;
      case "seccion":
        out.push(para([{ text: b.text, bold: true }], { align: "left", before: 240, keepNext: true }));
        break;
      case "p":
        for (const t of b.text.split(/\n+/)) out.push(para([{ text: t }]));
        break;
      case "ordinales":
        b.items.forEach((it, i) => out.push(para([{ text: `${ordinalLabel(i, b.prefix)}: `, bold: true }, { text: it }])));
        break;
      case "firma":
        out.push(para([{ text: "" }], { before: 480, after: 0 }));
        for (const l of b.lines) out.push(para([{ text: l || "______________________________", plain: !l }], { align: "center", after: 0, before: l ? 0 : 480 }));
        break;
    }
  }
  return out.join("");
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-CR" w:eastAsia="es-CR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;

const field = (instr: string) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Página </w:t></w:r>${field("PAGE")}<w:r><w:t xml:space="preserve"> de </w:t></w:r>${field("NUMPAGES")}</w:p></w:ftr>`;

/** El .docx completo, como bytes. */
export function writingDocx(title: string, blocks: Block[], opts: { author?: string } = {}): Uint8Array {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
  );
  zip.file("word/styles.xml", STYLES);
  zip.file("word/footer1.xml", FOOTER);
  // Carta (21,59 × 27,94 cm) con márgenes de 2,5 cm (1418 twips).
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${blocksToDocxBody(blocks)}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>${x(opts.author ?? "")}</dc:creator><dc:language>es-CR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Gestión del bufete</Application></Properties>`,
  );
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

/** Puntos que faltan por completar en un escrito: [PENDIENTE…] y líneas en blanco «________». */
export function pendingItems(blocks: Block[]): { section: string; text: string }[] {
  const out: { section: string; text: string }[] = [];
  let section = "Encabezado";
  const scan = (t: string) => {
    for (const m of t.matchAll(/\[PENDIENTE[^\]]*\]/g)) out.push({ section, text: m[0] });
    let from = 0;
    for (let at = t.indexOf(BLANK); at >= 0; at = t.indexOf(BLANK, from)) {
      const start = Math.max(from, at - 40);
      const before = t.slice(start, at).replace(start > from ? /^\S*\s/ : /^/, "").replace(/^[\s,.;:]+/, "").trim();
      out.push({ section, text: `Dato en blanco: «…${before} ________»` });
      from = at + BLANK.length;
      while (t[from] === "_") from++;
    }
  };
  for (const b of blocks) {
    if (b.t === "seccion") section = b.text.charAt(0) + b.text.slice(1).toLowerCase();
    else if (b.t === "p" || b.t === "titulo" || b.t === "encabezado") scan(b.text);
    else if (b.t === "ordinales") b.items.forEach((it, i) => { const before = out.length; scan(it); for (let k = before; k < out.length; k++) out[k] = { ...out[k], section: `${section} · ${ordinalLabel(i, b.prefix).toLowerCase()}` }; });
    else if (b.t === "firma") b.lines.forEach(scan);
  }
  return out;
}
