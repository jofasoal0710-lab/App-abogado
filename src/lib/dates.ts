const LOCALE = "es-ES";

/** Fecha 'YYYY-MM-DD' (columna date) → '14/11/2026'. Sin conversiones de zona horaria. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** Hoy en formato YYYY-MM-DD (hora local del servidor). */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Días naturales que faltan hasta la fecha (negativo = vencido). */
export function daysUntil(target: Date | string, now = new Date()): number {
  const t = new Date(target);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((startOfTarget - startOfToday) / 86_400_000);
}

export function relativeDays(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === -1) return "ayer";
  if (days > 0) return `en ${days} días`;
  return `hace ${-days} días`;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toDateTimeLocalValue(d: Date): string {
  return `${todayISO(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Primer y último día (YYYY-MM-DD) del mes 'YYYY-MM'. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(now = new Date()): string {
  return todayISO(now).slice(0, 7);
}

/** Semanas (lunes a domingo) que cubren el mes 'YYYY-MM', como fechas YYYY-MM-DD. */
export function buildMonthGrid(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: string[][] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - offset + i)).toISOString().slice(0, 10);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(d);
  }
  return weeks;
}

/** Clave YYYY-MM-DD de un instante en la zona horaria del proceso. */
export function dayKey(d: Date): string {
  return todayISO(d);
}
