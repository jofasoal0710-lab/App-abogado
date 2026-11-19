/**
 * Quincenas del índice notarial: del 1 al 15 y del 16 al último día del mes. Se identifican como
 * «AAAA-MM-1» (primera) o «AAAA-MM-2» (segunda).
 */
export type Quincena = { key: string; start: string; end: string; label: string };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Quincena de una fecha «AAAA-MM-DD». */
export function quincenaOf(iso: string): Quincena {
  const [y, m, d] = iso.split("-").map(Number);
  return quincena(`${y}-${pad(m)}-${d <= 15 ? 1 : 2}`)!;
}

/** Rango [start, end] (ambos incluidos) de una quincena; null si la clave no es válida. */
export function quincena(key: string): Quincena | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])-([12])$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), half = Number(m[3]);
  const start = `${y}-${pad(mo)}-${half === 1 ? "01" : "16"}`;
  const end = `${y}-${pad(mo)}-${half === 1 ? "15" : pad(lastDay(y, mo))}`;
  const label = `${half === 1 ? "Del 1 al 15" : `Del 16 al ${lastDay(y, mo)}`} de ${MONTHS[mo - 1]} de ${y}`;
  return { key, start, end, label };
}

/** Quincena anterior o siguiente. */
export function shiftQuincena(key: string, delta: 1 | -1): string {
  const q = quincena(key)!;
  const [y, mo, half] = q.key.split("-").map(Number);
  let idx = (y * 12 + (mo - 1)) * 2 + (half - 1) + delta;
  const ny = Math.floor(idx / 24);
  idx -= ny * 24;
  return `${ny}-${pad(Math.floor(idx / 2) + 1)}-${(idx % 2) + 1}`;
}
