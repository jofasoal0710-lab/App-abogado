/**
 * Cálculos de los reportes del despacho (puros: sin base de datos). Fechas «AAAA-MM-DD», importes en céntimos.
 */

export type Period = { from: string; to: string; label: string; key: string };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

export const PERIOD_PRESETS = {
  mes: "Este mes",
  mes_anterior: "Mes anterior",
  trimestre: "Este trimestre",
  anio: "Este año",
  anio_anterior: "Año anterior",
  ultimos_12: "Últimos 12 meses",
} as const;
export type PeriodPreset = keyof typeof PERIOD_PRESETS;

/** Periodo a partir de un atajo o de fechas propias (si son válidas y en orden). */
export function resolvePeriod(input: { preset?: string; from?: string; to?: string }, today: string): Period {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  if (ok(input.from) && ok(input.to) && input.from! <= input.to!) {
    return { from: input.from!, to: input.to!, key: "personalizado", label: `Del ${input.from!.split("-").reverse().join("/")} al ${input.to!.split("-").reverse().join("/")}` };
  }
  const [y, m] = today.split("-").map(Number);
  const preset = (input.preset && input.preset in PERIOD_PRESETS ? input.preset : "mes") as PeriodPreset;
  switch (preset) {
    case "mes_anterior": {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      return { from: iso(py, pm, 1), to: iso(py, pm, lastDay(py, pm)), key: preset, label: `${MONTHS[pm - 1]} de ${py}` };
    }
    case "trimestre": {
      const q = Math.floor((m - 1) / 3);
      return { from: iso(y, q * 3 + 1, 1), to: iso(y, q * 3 + 3, lastDay(y, q * 3 + 3)), key: preset, label: `${q + 1}.º trimestre de ${y}` };
    }
    case "anio":
      return { from: iso(y, 1, 1), to: iso(y, 12, 31), key: preset, label: `año ${y}` };
    case "anio_anterior":
      return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31), key: preset, label: `año ${y - 1}` };
    case "ultimos_12": {
      const fy = m === 12 ? y : y - 1, fm = m === 12 ? 1 : m + 1;
      return { from: iso(fy, fm, 1), to: iso(y, m, lastDay(y, m)), key: preset, label: "últimos 12 meses" };
    }
    default:
      return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)), key: "mes", label: `${MONTHS[m - 1]} de ${y}` };
  }
}

/* ---------------- Antigüedad de la cartera ---------------- */

export const AGING_BUCKETS = ["al_dia", "d1_30", "d31_60", "d61_90", "d90"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export const AGING_LABELS: Record<AgingBucket, string> = { al_dia: "Sin vencer", d1_30: "1 a 30 días", d31_60: "31 a 60 días", d61_90: "61 a 90 días", d90: "Más de 90 días" };

/** Días de atraso respecto al vencimiento (o a la emisión, si la factura no tiene vencimiento). */
export function daysOverdue(dueOrIssue: string, today: string): number {
  return Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dueOrIssue}T12:00:00Z`)) / 86_400_000);
}

export function agingBucket(dueOrIssue: string, today: string): AgingBucket {
  const d = daysOverdue(dueOrIssue, today);
  if (d <= 0) return "al_dia";
  if (d <= 30) return "d1_30";
  if (d <= 60) return "d31_60";
  if (d <= 90) return "d61_90";
  return "d90";
}

/* ---------------- Agregaciones ---------------- */

/** Suma por clave, conservando el orden de mayor a menor según `sortBy`. */
export function groupSum<T, F extends Record<string, (r: T) => number>>(rows: T[], key: (r: T) => string, fields: F, sortBy: keyof F & string) {
  type Sums = { [K in keyof F]: number };
  const map = new Map<string, Sums>();
  for (const r of rows) {
    const k = key(r);
    const acc = map.get(k) ?? (Object.fromEntries(Object.keys(fields).map((f) => [f, 0])) as Sums);
    for (const f of Object.keys(fields) as (keyof F)[]) acc[f] += fields[f](r);
    map.set(k, acc);
  }
  return [...map.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b[sortBy] - a[sortBy]);
}

/** Valor de las horas: minutos × tarifa por hora / 60, redondeado al céntimo. */
export const hoursValueCents = (minutes: number, rateCents: number) => Math.round((minutes * rateCents) / 60);

/** Porcentaje entero (0 si el divisor es 0). */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Horas con un decimal a partir de minutos, p. ej. 90 → "1,5". */
export const fmtHours = (minutes: number) => (Math.round(minutes / 6) / 10).toLocaleString("es-CR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
