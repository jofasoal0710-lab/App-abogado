import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { ordinalLabel, type Block } from "./forms/engine";
import { safeText } from "./pdf-text";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Cuerpo en HTML (Word lo abre y deja editarlo y guardarlo como .docx). */
export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "titulo":
          return `<p class="c"><b>${esc(b.text)}</b></p>`;
        case "encabezado":
          return `<p><b>${esc(b.text)}</b></p>`;
        case "seccion":
          return `<p style="margin-top:14pt"><b>${esc(b.text)}</b></p>`;
        case "p":
          return `<p class="j">${esc(b.text)}</p>`;
        case "ordinales":
          return b.items.map((it, i) => `<p class="j"><b>${esc(ordinalLabel(i, b.prefix))}:</b> ${esc(it)}</p>`).join("");
        case "firma":
          return `<p class="c" style="margin-top:40pt">${b.lines.map((l) => (l ? esc(l) : "______________________________")).join("<br>")}</p>`;
      }
    })
    .join("\n");
}

/** Documento completo para Word (tamaño carta, márgenes de 2,5 cm, Times New Roman 12, interlineado 1,8). */
export function wordDocument(title: string, blocks: Block[]): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:21.59cm 27.94cm;margin:2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.8}p{margin:0 0 8pt}.j{text-align:justify}.c{text-align:center}</style></head><body>${blocksToHtml(blocks)}</body></html>`;
}

/** Vista de cómo quedará en Word: la misma hoja, dentro de la app. */
export function wordPreviewPage(title: string, blocks: Block[]): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{margin:0;background:#e9ecf3;font-family:"Times New Roman",Times,serif}.page{box-sizing:border-box;width:21.59cm;min-height:27.94cm;margin:24px auto;padding:2.5cm;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.18);font-size:12pt;line-height:1.8;color:#111}p{margin:0 0 8pt}.j{text-align:justify}.c{text-align:center}@media (max-width:24cm){.page{width:auto;margin:0;padding:1.2cm;min-height:0}}</style></head>
<body><div class="page">${blocksToHtml(blocks)}</div></body></html>`;
}

/* ---------------- PDF ---------------- */

const LETTER: [number, number] = [612, 792];
const MARGIN = 71; // 2,5 cm
const SIZE = 12;
const LEADING = SIZE * 1.8;
const INK = rgb(0.07, 0.07, 0.07);

type Word = { text: string; font: PDFFont };

/** PDF del escrito: carta, Times 12, interlineado 1,8, párrafos justificados y numeración de páginas. */
export async function writingPdf(title: string, blocks: Block[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  doc.setTitle(title);
  doc.setProducer("Gestión del bufete");
  const width = LETTER[0] - 2 * MARGIN;
  let page: PDFPage = doc.addPage(LETTER);
  let y = LETTER[1] - MARGIN;

  const newPageIfNeeded = (needed = LEADING) => {
    if (y - needed < MARGIN) {
      page = doc.addPage(LETTER);
      y = LETTER[1] - MARGIN;
    }
  };
  const words = (text: string, font: PDFFont): Word[] =>
    safeText(font, text)
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ text: t, font }));
  const wWidth = (w: Word) => w.font.widthOfTextAtSize(w.text, SIZE);
  const space = regular.widthOfTextAtSize(" ", SIZE);

  /** Escribe un párrafo: justificado (salvo la última línea), centrado o a la izquierda. */
  const paragraph = (ws: Word[], align: "justify" | "left" | "center", before = 0) => {
    if (ws.length === 0) return;
    y -= before;
    const lines: Word[][] = [];
    let line: Word[] = [];
    let lineW = 0;
    for (const w of ws) {
      const add = wWidth(w) + (line.length ? space : 0);
      if (line.length && lineW + add > width) {
        lines.push(line);
        line = [w];
        lineW = wWidth(w);
      } else {
        line.push(w);
        lineW += add;
      }
    }
    if (line.length) lines.push(line);
    lines.forEach((ln, i) => {
      newPageIfNeeded();
      const natural = ln.reduce((s, w) => s + wWidth(w), 0);
      const last = i === lines.length - 1;
      const gap = align === "justify" && !last && ln.length > 1 ? (width - natural) / (ln.length - 1) : space;
      const used = natural + gap * (ln.length - 1);
      let x = align === "center" ? MARGIN + (width - used) / 2 : MARGIN;
      for (const w of ln) {
        page.drawText(w.text, { x, y: y - SIZE, size: SIZE, font: w.font, color: INK });
        x += wWidth(w) + gap;
      }
      y -= LEADING;
    });
    y -= 6;
  };

  for (const b of blocks) {
    switch (b.t) {
      case "titulo":
        paragraph(words(b.text, bold), "center");
        break;
      case "encabezado":
        paragraph(words(b.text, bold), "left");
        break;
      case "seccion":
        newPageIfNeeded(LEADING * 3);
        paragraph(words(b.text, bold), "left", 10);
        break;
      case "p":
        for (const para of b.text.split(/\n+/)) paragraph(words(para, regular), "justify");
        break;
      case "ordinales":
        b.items.forEach((it, i) => paragraph([...words(`${ordinalLabel(i, b.prefix)}:`, bold), ...words(it, regular)], "justify"));
        break;
      case "firma":
        newPageIfNeeded(LEADING * (b.lines.length + 3));
        y -= LEADING * 1.5;
        for (const l of b.lines) {
          if (l) paragraph(words(l, regular), "center");
          else {
            y -= LEADING;
            page.drawLine({ start: { x: MARGIN + width / 2 - 110, y }, end: { x: MARGIN + width / 2 + 110, y }, thickness: 0.6, color: INK });
            y -= 8;
          }
        }
        break;
    }
  }

  const pages = doc.getPages();
  if (pages.length > 1)
    pages.forEach((p, i) => {
      const t = `${i + 1} / ${pages.length}`;
      p.drawText(t, { x: LETTER[0] / 2 - regular.widthOfTextAtSize(t, 9) / 2, y: 36, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
    });
  return doc.save();
}
