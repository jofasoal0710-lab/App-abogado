/**
 * Cronómetro de horas: lógica pura. Cada persona tiene como mucho un cronómetro (en marcha o en pausa)
 * vinculado a un expediente. Al detenerlo se convierte en una entrada de horas redondeada hacia arriba
 * al tramo configurado (por defecto 6 minutos = 0,1 h, lo habitual al facturar por horas).
 */
export type TimerState = { startedAt: Date | null; accumulatedSeconds: number };

/** Segundos transcurridos: lo acumulado en tramos anteriores + el tramo en marcha (si lo hay). */
export function elapsedSeconds(t: TimerState, now: Date): number {
  const running = t.startedAt ? Math.max(0, Math.floor((now.getTime() - t.startedAt.getTime()) / 1000)) : 0;
  return t.accumulatedSeconds + running;
}

/** Tramo de redondeo en minutos (1–60). Valores raros vuelven al predeterminado (6). */
export function roundingStep(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : 6;
}

/** Minutos a registrar: hacia arriba al tramo, como mínimo un tramo. */
export function billableMinutes(seconds: number, step: number): number {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  return Math.max(step, Math.ceil(minutes / step) * step);
}

/** «1:05:09» o «12:03» para mostrar en pantalla. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

/** Más de 12 horas seguidas es casi seguro un olvido: se avisa antes de registrarlo. */
export const FORGOTTEN_AFTER_SECONDS = 12 * 3600;
