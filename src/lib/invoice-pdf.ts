import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "./dates";
import { formatMoney, formatQuantity, invoiceTotals, lineAmountCents, type LineItem } from "./money";
import { fitFontSize, safeText, wrapText } from "./pdf-text";

export type InvoicePdfInput = {
  firm: { name: string; taxId: string; address: string };
  invoice: {
    number: string | null;
    status: "borrador" | "emitida" | "pagada" | "anulada";
    kind: "factura" | "rectificativa";
    issueDate: string;
    dueDate: string | null;
    taxRate: number;
    withholdingRate: number;
    notes: string | null;
    rectificationReason: string | null;
  };
  client: { name: string; taxId: string | null; address: string | null };
  matter: { number: string; title: string } | null;
  items: (LineItem & { description: string })[];
  /** Factura que esta rectifica (si es una rectificativa). */
  rectifies: { number: string | null; issueDate: string } | null;
  /** Números de las rectificativas emitidas que corrigen esta factura. */
  rectifiedBy: string[];
};

const A4: [number, number] = [595.28, 841.89];
const M = 48; // margen
const INK = rgb(0.12, 0.14, 0.19);
const GRAY = rgb(0.4, 0.43, 0.5);
const LINE = rgb(0.82, 0.85, 0.9);
const COLS = { concept: M, qty: 330, price: 410, amount: A4[0] - M }; // qty/price/amount alineados a la derecha

const money = (cents: number) => formatMoney(cents).replace(/[  ]/g, " ");

/** Genera el PDF de una factura (o rectificativa, o borrador con marca de agua). */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { firm, invoice: inv, client, matter, items } = input;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const isRect = inv.kind === "rectificativa";
  const isDraft = inv.status === "borrador";
  const title = isRect ? "FACTURA RECTIFICATIVA" : "FACTURA";
  const label = inv.number ?? "Borrador";
  doc.setTitle(`${title} ${label}`);
  doc.setProducer("Gestión del bufete");

  const t = (s: string) => safeText(regular, s);
  // La marca de agua se dibuja AL CREAR la página, antes que el contenido: queda por debajo y no deslustra el texto.
  const newPage = (): PDFPage => {
    const p = doc.addPage(A4);
    if (isDraft) p.drawText("BORRADOR", { x: 110, y: 250, size: 96, font: bold, color: rgb(0.9, 0.91, 0.94), rotate: degrees(40) });
    return p;
  };
  let page: PDFPage = newPage();
  let y = A4[1] - M;

  const text = (s: string, x: number, size: number, font: PDFFont = regular, color = INK, rightAlign = false) => {
    const clean = safeText(font, s);
    const width = font.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: rightAlign ? x - width : x, y, size, font, color });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: A4[0] - M, y: yy }, thickness: 0.6, color: LINE });
  const ensure = (needed: number) => {
    if (y - needed >= M + 40) return;
    page = newPage();
    y = A4[1] - M;
    tableHeader();
  };

  // ---- Cabecera
  text(firm.name, M, 15, bold);
  const headerTop = y;
  y -= 15;
  if (firm.taxId) { text(`NIF ${firm.taxId}`, M, 9, regular, GRAY); y -= 12; }
  for (const ln of wrapText(t(firm.address), regular, 9, 250)) { if (ln) { text(ln, M, 9, regular, GRAY); y -= 12; } }
  const leftBottom = y;
  y = headerTop;
  text(title, A4[0] - M, 15, bold, INK, true);
  y -= 15; text(label, A4[0] - M, 11, bold, INK, true);
  y -= 13; text(`Fecha: ${formatDate(inv.issueDate)}`, A4[0] - M, 9, regular, GRAY, true);
  if (!isRect && inv.dueDate) { y -= 12; text(`Vencimiento: ${formatDate(inv.dueDate)}`, A4[0] - M, 9, regular, GRAY, true); }
  y = Math.min(y, leftBottom) - 14;
  rule(y);
  y -= 20;

  // ---- Cliente
  text("CLIENTE", M, 8, bold, GRAY); y -= 14;
  text(client.name, M, 11, bold); y -= 13;
  if (client.taxId) { text(`NIF/CIF ${client.taxId}`, M, 9, regular, GRAY); y -= 12; }
  for (const ln of wrapText(t(client.address ?? ""), regular, 9, 330)) { if (ln) { text(ln, M, 9, regular, GRAY); y -= 12; } }
  if (matter) { text(`Expediente: ${matter.number} · ${matter.title}`.slice(0, 110), M, 9, regular, GRAY); y -= 12; }
  y -= 8;

  // ---- Referencia (rectificativa)
  if (isRect) {
    rule(y); y -= 18;
    text("FACTURA RECTIFICADA", M, 8, bold, GRAY); y -= 13;
    const ref = input.rectifies
      ? `Rectifica la factura ${input.rectifies.number ?? "(sin número)"} de fecha ${formatDate(input.rectifies.issueDate)}. Método: por diferencias.`
      : "Factura original no disponible.";
    for (const ln of wrapText(t(ref), regular, 9.5, A4[0] - 2 * M)) { text(ln, M, 9.5); y -= 12; }
    for (const ln of wrapText(t(`Motivo: ${inv.rectificationReason ?? ""}`), regular, 9.5, A4[0] - 2 * M)) { text(ln, M, 9.5); y -= 12; }
    y -= 6;
  }
  rule(y); y -= 6;

  // ---- Tabla de líneas
  function tableHeader() {
    y -= 12;
    text("CONCEPTO", COLS.concept, 8, bold, GRAY);
    text("CANTIDAD", COLS.qty, 8, bold, GRAY, true);
    text("PRECIO", COLS.price, 8, bold, GRAY, true);
    text("IMPORTE", COLS.amount, 8, bold, GRAY, true);
    y -= 6;
    rule(y);
    y -= 4;
  }
  tableHeader();

  const conceptWidth = COLS.qty - COLS.concept - 70;
  if (items.length === 0) { y -= 14; text("Sin líneas.", M, 9, regular, GRAY); y -= 6; }
  for (const it of items) {
    const lines = wrapText(t(it.description), regular, 9.5, conceptWidth);
    ensure(lines.length * 12 + 10);
    y -= 13;
    const rowTop = y;
    lines.forEach((ln, i) => { y = rowTop - i * 12; text(ln, COLS.concept, 9.5); });
    y = rowTop;
    text(formatQuantity(it), COLS.qty, 9.5, regular, INK, true);
    text(`${money(it.unitPriceCents)}${it.unit === "horas" ? " /h" : ""}`, COLS.price, 9.5, regular, INK, true);
    text(money(lineAmountCents(it)), COLS.amount, 9.5, regular, INK, true);
    y = rowTop - (lines.length - 1) * 12 - 6;
    rule(y);
  }

  // ---- Totales
  const totals = invoiceTotals(items, inv.taxRate, inv.withholdingRate);
  ensure(110);
  y -= 22;
  const labelX = 340;
  const row = (l: string, v: string, strong = false) => {
    const font = strong ? bold : regular;
    const amountSize = strong ? 11 : 9.5;
    const amountWidth = font.widthOfTextAtSize(safeText(font, v), amountSize);
    // El rótulo se reduce si no cabe junto al importe (importes grandes o rótulos largos): nunca se solapan.
    const labelSize = fitFontSize(font, safeText(font, l), COLS.amount - amountWidth - 14 - labelX, 9.5);
    text(l, labelX, labelSize, font, strong ? INK : GRAY);
    text(v, COLS.amount, amountSize, font, INK, true);
    y -= strong ? 16 : 14;
  };
  row("Base imponible", money(totals.subtotalCents));
  row(`IVA (${inv.taxRate} %)`, money(totals.taxCents));
  if (inv.withholdingRate > 0) row(`Retención IRPF (${inv.withholdingRate} %)`, money(-totals.withholdingCents));
  page.drawLine({ start: { x: labelX, y: y + 10 }, end: { x: A4[0] - M, y: y + 10 }, thickness: 0.8, color: INK });
  y -= 4;
  row(isRect ? "TOTAL RECTIFICACIÓN" : "TOTAL", money(totals.totalCents), true);

  // ---- Notas y avisos
  if (input.rectifiedBy.length) {
    ensure(40); y -= 6;
    for (const ln of wrapText(t(`Esta factura ha sido rectificada por: ${input.rectifiedBy.join(", ")}.`), regular, 9, A4[0] - 2 * M)) { text(ln, M, 9, regular, GRAY); y -= 12; }
  }
  if (inv.notes) {
    ensure(40); y -= 10;
    text("OBSERVACIONES", M, 8, bold, GRAY); y -= 13;
    for (const ln of wrapText(t(inv.notes), regular, 9.5, A4[0] - 2 * M)) { ensure(14); text(ln, M, 9.5); y -= 12; }
  }

  // ---- Pie de página y marca de agua en todas las páginas
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const foot = safeText(regular, `${firm.name} · ${label} · Página ${i + 1} de ${pages.length}`);
    p.drawText(foot, { x: M, y: 28, size: 8, font: regular, color: GRAY });
  });

  return doc.save();
}
