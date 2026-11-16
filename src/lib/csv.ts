/**
 * CSV pensado para Excel en español: separador «;», coma decimal, fechas dd/mm/aaaa, UTF-8 con BOM.
 * Los textos que empiezan por = + - @ se neutralizan: un nombre de cliente como «=HIPERVINCULO(...)» no
 * debe ejecutarse como fórmula al abrir el fichero (inyección de fórmulas / CSV injection).
 */
export const CSV_BOM = "﻿";
const SEP = ";";

function quote(cell: string): string {
  return /[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Celda de TEXTO: neutraliza fórmulas y escapa lo necesario. */
export function csvText(value: string | null | undefined): string {
  let v = (value ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return quote(v);
}

/** Importe en céntimos → «1234,56» / «-12,50» (sin separador de miles). Es numérico: no se neutraliza. */
export function csvDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** «2026-11-14» → «14/11/2026». */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Une filas ya formateadas (cada celda por csvText/csvDecimal/csvDate). */
export function toCsv(header: string[], rows: string[][]): string {
  return CSV_BOM + [header.map(csvText), ...rows].map((r) => r.join(SEP)).join("\r\n") + "\r\n";
}
