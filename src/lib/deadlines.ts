/**
 * Semáforo de plazos: qué tan urgente es un evento según los días que faltan.
 *  vencido · hoy · pronto (1–2 días) · semana (3–7) · luego (más de 7) · hecho (completado)
 */
import { businessDaysUntil } from "./cr-holidays";

export type Urgency = "vencido" | "hoy" | "pronto" | "semana" | "luego" | "hecho";

export const URGENCY: Record<Urgency, { label: string; bar: string; badge: string; dot: string }> = {
  vencido: { label: "Vencido", bar: "bg-red-600", badge: "badge-red", dot: "bg-red-600" },
  hoy: { label: "Hoy", bar: "bg-red-500", badge: "badge-red", dot: "bg-red-500" },
  pronto: { label: "Mañana o pasado", bar: "bg-orange-500", badge: "badge-amber", dot: "bg-orange-500" },
  semana: { label: "Esta semana", bar: "bg-amber-400", badge: "badge-amber", dot: "bg-amber-400" },
  luego: { label: "Más adelante", bar: "bg-emerald-500", badge: "badge-green", dot: "bg-emerald-500" },
  hecho: { label: "Completado", bar: "bg-ink-300", badge: "badge-gray", dot: "bg-ink-300" },
};

export function urgencyOf(days: number, completed: boolean): Urgency {
  if (completed) return "hecho";
  if (days < 0) return "vencido";
  if (days === 0) return "hoy";
  if (days <= 2) return "pronto";
  if (days <= 7) return "semana";
  return "luego";
}

/** «Vence hoy», «vence mañana», «faltan 3 días hábiles (5 naturales)», «venció hace 2 días». */
export function countdown(dateISO: string, todayISO: string, days: number, completed: boolean): string {
  if (completed) return "completado";
  if (days < 0) return days === -1 ? "venció ayer" : `venció hace ${-days} días`;
  if (days === 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  const hab = businessDaysUntil(todayISO, dateISO);
  return hab === days ? `faltan ${days} días` : `faltan ${hab} ${hab === 1 ? "día hábil" : "días hábiles"} (${days} naturales)`;
}
