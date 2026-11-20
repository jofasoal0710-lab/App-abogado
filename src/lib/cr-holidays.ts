/**
 * Feriados de Costa Rica (art. 148 del Código de Trabajo, texto vigente), para cualquier año:
 * 1 de enero, 11 de abril, Jueves y Viernes Santos, 1 de mayo, 25 de julio, 2 y 15 de agosto,
 * 31 de agosto, 15 de setiembre, 1 de diciembre y 25 de diciembre. Incluye los traslados del
 * transitorio (Leyes 9875 y 10396, años 2020 a 2024). No incluye cierres del Poder Judicial: esos se
 * indican aparte cuando corresponda.
 */
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

const shift = (date: string, days: number) => {
  const x = new Date(`${date}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const nextMonday = (date: string) => shift(date, (8 - weekday(date)) % 7 || 7);
const prevMonday = (date: string) => shift(date, -((weekday(date) + 6) % 7 || 7));

/** Traslados del transitorio al art. 148 (solo esos años). */
const MOVES: Record<string, "siguiente" | "anterior"> = {
  "2020-07-25": "siguiente",
  "2020-08-15": "siguiente",
  "2020-09-15": "anterior",
  "2020-12-01": "anterior",
  "2021-05-01": "siguiente",
  "2021-07-25": "siguiente",
  "2021-09-15": "anterior",
  "2021-12-01": "anterior",
  "2022-09-15": "siguiente",
  "2022-12-01": "siguiente",
  "2023-04-11": "anterior",
  "2023-07-25": "anterior",
  "2023-08-15": "anterior",
  "2024-04-11": "siguiente",
};

export type Holiday = { date: string; name: string };

export function holidaysOf(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: ymd(year, 1, 1), name: "Año Nuevo" },
    { date: shift(easter, -3), name: "Jueves Santo" },
    { date: shift(easter, -2), name: "Viernes Santo" },
    { date: ymd(year, 4, 11), name: "Juan Santamaría" },
    { date: ymd(year, 5, 1), name: "Día del Trabajo" },
    { date: ymd(year, 7, 25), name: "Anexión del Partido de Nicoya" },
    { date: ymd(year, 8, 2), name: "Virgen de los Ángeles" },
    { date: ymd(year, 8, 15), name: "Día de la Madre" },
    { date: ymd(year, 8, 31), name: "Día de la Persona Negra y la Cultura Afrocostarricense" },
    { date: ymd(year, 9, 15), name: "Independencia" },
    { date: ymd(year, 12, 1), name: "Abolición del Ejército" },
    { date: ymd(year, 12, 25), name: "Navidad" },
  ];
  return list
    .map((h) => (MOVES[h.date] ? { ...h, date: MOVES[h.date] === "siguiente" ? nextMonday(h.date) : prevMonday(h.date) } : h))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const cache = new Map<number, Map<string, string>>();
export function holidayName(date: string): string | null {
  const y = Number(date.slice(0, 4));
  if (!cache.has(y)) cache.set(y, new Map(holidaysOf(y).map((h) => [h.date, h.name])));
  return cache.get(y)!.get(date) ?? null;
}

/** Día hábil: de lunes a viernes y no feriado. */
export function isBusinessDayCR(date: string): boolean {
  const w = weekday(date);
  return w !== 0 && w !== 6 && !holidayName(date);
}

/** Suma n días hábiles a partir del día siguiente a `date`. */
export function addBusinessDaysCR(date: string, n: number): string {
  let d = date;
  let count = 0;
  while (count < n) {
    d = shift(d, 1);
    if (isBusinessDayCR(d)) count++;
  }
  return d;
}

/** Días hábiles desde mañana hasta `to` (incluido). 0 si `to` es hoy o anterior. */
export function businessDaysUntil(from: string, to: string): number {
  if (to <= from) return 0;
  let d = from;
  let n = 0;
  while (d < to) {
    d = shift(d, 1);
    if (isBusinessDayCR(d)) n++;
  }
  return n;
}
