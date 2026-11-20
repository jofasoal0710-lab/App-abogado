/**
 * Cálculos jurídicos deterministas (sin IA): liquidación laboral y vencimiento de plazos procesales.
 * Cada resultado explica de dónde sale cada cifra y qué artículo lo respalda.
 */
import { isBusinessDayCR } from "./cr-holidays";

/* ---------------- Liquidación laboral (Código de Trabajo) ---------------- */

export type SettlementInput = {
  /** Fecha de ingreso y de salida (AAAA-MM-DD). */
  start: string;
  end: string;
  /** Promedio de salarios de los últimos 6 meses (art. 30 b). */
  avgMonthlySalary: number;
  /** ¿Despido sin justa causa u otra causa ajena al trabajador? (si no, no hay preaviso ni cesantía). */
  withoutJustCause: boolean;
  /** ¿Se dio el preaviso trabajado? (si se dio, no se paga). */
  noticeGiven?: boolean;
  /** Días de vacaciones pendientes; si falta, se estima con el art. 153 desde el último aniversario. */
  pendingVacationDays?: number;
  /** Salarios devengados desde el 1 de diciembre (aguinaldo); si falta, se estima con el promedio. */
  aguinaldoBase?: number;
};

export type SettlementLine = { concept: string; days: number | null; amount: number; basis: string };
export type Settlement = { years: number; months: number; days: number; dailySalary: number; lines: SettlementLine[]; total: number; notes: string[] };

/** Diferencia en años, meses y días completos entre dos fechas. */
export function seniority(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  let years = y2 - y1;
  let months = m2 - m1;
  let days = d2 - d1;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(y2, m2 - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days, totalMonths: years * 12 + months + days / 30 };
}

/** Tabla del artículo 29 (días de salario por año, según los años de servicio). */
const CESANTIA_TABLE: Record<number, number> = { 1: 19.5, 2: 20, 3: 20.5, 4: 21, 5: 21.24, 6: 21.5, 7: 22, 8: 22, 9: 22, 10: 21.5, 11: 21, 12: 20.5 };

/** Días de cesantía según el art. 29 (fracción superior a seis meses = año completo desde el 2.º año; tope de 8 años). */
export function cesantiaDays(totalMonths: number): { days: number; basis: string } {
  if (totalMonths < 3) return { days: 0, basis: "Menos de tres meses: no corresponde (art. 29)." };
  if (totalMonths <= 6) return { days: 7, basis: "Entre 3 y 6 meses: 7 días de salario (art. 29, inciso 1)." };
  if (totalMonths < 12) return { days: 14, basis: "Más de 6 meses y menos de un año: 14 días de salario (art. 29, inciso 2)." };
  const whole = Math.floor(totalMonths / 12);
  const fraction = totalMonths - whole * 12;
  const years = whole >= 1 && fraction > 6 ? whole + 1 : whole;
  const perYear = years >= 13 ? 20 : CESANTIA_TABLE[years];
  const counted = Math.min(years, 8);
  return {
    days: Math.round(perYear * counted * 100) / 100,
    basis: `${years} ${years === 1 ? "año" : "años"} de servicio${fraction > 6 && whole >= 1 ? " (la fracción superior a seis meses cuenta como año)" : ""}: ${String(perYear).replace(".", ",")} días por año × ${counted} ${counted === 1 ? "año" : "años"}${years > 8 ? " (tope de 8 años)" : ""} (art. 29, inciso 3${years > 8 ? " y 4" : ""}).`,
  };
}

/** Días de preaviso según el art. 28. */
export function noticeDays(totalMonths: number): { days: number; basis: string } {
  if (totalMonths < 3) return { days: 0, basis: "Menos de tres meses: no corresponde (art. 28)." };
  if (totalMonths <= 6) return { days: 7, basis: "Entre 3 y 6 meses: una semana (art. 28)." };
  if (totalMonths <= 12) return { days: 15, basis: "Entre 6 meses y un año: quince días (art. 28)." };
  return { days: 30, basis: "Más de un año: un mes (art. 28)." };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function laborSettlement(input: SettlementInput): Settlement {
  const s = seniority(input.start, input.end);
  const daily = input.avgMonthlySalary / 30;
  const lines: SettlementLine[] = [];
  const notes: string[] = [
    "Salario diario = promedio de los últimos seis meses ÷ 30 (art. 30, inciso b).",
    "Estimación orientativa: revisa salario en especie, horas extra, comisiones y lo que diga el contrato o la convención colectiva.",
  ];
  if (input.withoutJustCause) {
    const n = noticeDays(s.totalMonths);
    if (n.days > 0 && !input.noticeGiven) lines.push({ concept: "Preaviso", days: n.days, amount: round(n.days * daily), basis: n.basis });
    if (input.noticeGiven) notes.push("El preaviso se dio trabajado, así que no se paga.");
    const c = cesantiaDays(s.totalMonths);
    if (c.days > 0) lines.push({ concept: "Auxilio de cesantía", days: c.days, amount: round(c.days * daily), basis: c.basis });
  } else {
    notes.push("Renuncia o despido con justa causa: no corresponden preaviso del patrono ni cesantía (arts. 28 y 29).");
  }
  // Vacaciones: pendientes indicadas o 1 día por mes desde el último aniversario (art. 153).
  let vacDays = input.pendingVacationDays;
  let vacBasis = "Días de vacaciones no disfrutados indicados (art. 156, inciso a).";
  if (vacDays === undefined) {
    vacDays = Math.floor(s.totalMonths - s.years * 12);
    vacBasis = `Estimado: ${vacDays} ${vacDays === 1 ? "mes" : "meses"} desde el último aniversario × 1 día (art. 153). Si hay períodos completos sin disfrutar, indícalos.`;
  }
  if (vacDays > 0) lines.push({ concept: "Vacaciones no disfrutadas", days: vacDays, amount: round(vacDays * daily), basis: vacBasis });
  // Aguinaldo proporcional: salarios desde el 1 de diciembre ÷ 12 (Ley 2412).
  const [ey, em] = input.end.split("-").map(Number);
  const decFirst = em === 12 ? `${ey}-12-01` : `${ey - 1}-12-01`;
  const from = input.start > decFirst ? input.start : decFirst;
  const monthsInPeriod = Math.min(12, seniority(from, input.end).totalMonths);
  const base = input.aguinaldoBase ?? input.avgMonthlySalary * monthsInPeriod;
  lines.push({
    concept: "Aguinaldo proporcional",
    days: null,
    amount: round(base / 12),
    basis: input.aguinaldoBase !== undefined ? "Salarios desde el 1 de diciembre ÷ 12 (Ley 2412)." : `Estimado: ${monthsInPeriod.toFixed(1).replace(".", ",")} meses desde el 1 de diciembre × salario promedio ÷ 12 (Ley 2412).`,
  });
  return { ...s, dailySalary: round(daily), lines, total: round(lines.reduce((a, l) => a + l.amount, 0)), notes };
}

/* ---------------- Plazos procesales (CPC, art. 30.5) ---------------- */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
};

/** Día hábil: ni fin de semana ni feriado nacional; además, los días de cierre que se indiquen. */
export function isWorkingDay(date: string, closedDays: ReadonlySet<string> = new Set()): boolean {
  return isBusinessDayCR(date) && !closedDays.has(date);
}

export type DeadlineInput = {
  /** Día en que quedó notificada la resolución (a todas las partes). */
  notified: string;
  amount: number;
  unit: "dias" | "meses" | "anos";
  /** Días inhábiles adicionales (p. ej. cierre colectivo del Poder Judicial). */
  closedDays?: string[];
};

export type Deadline = { start: string; due: string; skipped: string[]; explanation: string[] };

/**
 * Vencimiento según el art. 30.5 del CPC: empieza a correr el día hábil siguiente a la notificación;
 * los plazos por días son hábiles; por meses o años, de fecha a fecha (si el día no existe, el último
 * del mes); si el último día es inhábil, se prorroga al siguiente hábil.
 */
export function procedureDeadline(input: DeadlineInput): Deadline {
  const closed = new Set(input.closedDays ?? []);
  const skipped: string[] = [];
  let start = addDays(input.notified, 1);
  while (!isWorkingDay(start, closed)) {
    skipped.push(start);
    start = addDays(start, 1);
  }
  let due: string;
  if (input.unit === "dias") {
    let count = 1;
    due = start;
    while (count < input.amount) {
      due = addDays(due, 1);
      if (isWorkingDay(due, closed)) count++;
      else skipped.push(due);
    }
  } else {
    const [y, m, d] = input.notified.split("-").map(Number);
    const months = input.unit === "meses" ? input.amount : input.amount * 12;
    const ty = y + Math.floor((m - 1 + months) / 12);
    const tm = ((m - 1 + months) % 12) + 1;
    const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    due = `${ty}-${String(tm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  }
  const explanation = [
    `Notificación: ${input.notified}. El plazo empieza a correr el ${start} (día hábil siguiente, art. 30.5 CPC).`,
    input.unit === "dias" ? `Se cuentan ${input.amount} días hábiles (sin fines de semana ni feriados).` : `Por ${input.unit === "meses" ? "meses" : "años"} se cuenta de fecha a fecha.`,
  ];
  if (!isWorkingDay(due, closed)) explanation.push("El último día era inhábil: se prorroga al siguiente día hábil.");
  while (!isWorkingDay(due, closed)) {
    skipped.push(due);
    due = addDays(due, 1);
  }
  return { start, due, skipped: [...new Set(skipped)], explanation };
}
