import { addBusinessDays } from "@dojocoding/hacienda-sdk";
import type { Quincena } from "./notary-period";

/**
 * INDEX: plataforma del Archivo Nacional para presentar los índices notariales (se entra con firma digital).
 * El índice de cada quincena se presenta dentro de los 5 días hábiles siguientes a su cierre, aunque no se
 * haya otorgado ninguna escritura (índice en blanco).
 */
export const INDEX_URL = "https://www.index.co.cr/";
export const INDEX_BUSINESS_DAYS = 5;

/** Último día para presentar el índice de la quincena (días hábiles con feriados de Costa Rica). */
export function indexDeadline(q: Quincena): string {
  return addBusinessDays(q.end, INDEX_BUSINESS_DAYS).toISOString().slice(0, 10);
}

export type IndexState =
  | { kind: "presentado"; on: string; receipt: string | null }
  | { kind: "en_curso"; due: string }
  | { kind: "pendiente"; due: string; daysLeft: number }
  | { kind: "vencido"; due: string };

export function indexState(q: Quincena, today: string, submission: { submittedOn: string; receipt: string | null } | null): IndexState {
  if (submission) return { kind: "presentado", on: submission.submittedOn, receipt: submission.receipt };
  const due = indexDeadline(q);
  if (today <= q.end) return { kind: "en_curso", due };
  if (today > due) return { kind: "vencido", due };
  const daysLeft = Math.round((Date.parse(due) - Date.parse(today)) / 86400_000);
  return { kind: "pendiente", due, daysLeft };
}

export type IndexDeed = {
  number: number;
  grantedOn: string;
  grantedAt: string | null;
  act: string;
  volume: string | null;
  folioStart: number | null;
  folioEnd: number | null;
  status: "otorgada" | "no_paso";
  parties: { name: string; idNumber: string | null }[];
};

const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");

/** Una escritura como fila lista para copiar en INDEX (campos separados por tabuladores). */
export function indexRow(d: IndexDeed): string {
  const folios = d.folioStart ? `${d.folioStart}${d.folioEnd && d.folioEnd !== d.folioStart ? `-${d.folioEnd}` : ""}` : "";
  const parties = d.parties.map((p) => (p.idNumber ? `${p.name} (${p.idNumber})` : p.name)).join("; ");
  return [String(d.number), ddmmyyyy(d.grantedOn), d.grantedAt ?? "", d.act + (d.status === "no_paso" ? " (NO PASÓ)" : ""), d.volume ?? "", folios, parties]
    .map((v) => v.replace(/[\t\r\n]+/g, " ").trim())
    .join("\t");
}
