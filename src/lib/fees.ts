/**
 * Precio sugerido de un servicio del tarifario del despacho y comparación con el arancel oficial.
 * Puro (sin base de datos): se usa en el servidor y en la ventana de ayuda del navegador.
 */
import { arancelItem, arancelMinimum, crc, type ArancelResult, type ArancelStage } from "./arancel";

export type FeeMode = "fijo" | "horas" | "porcentaje" | "arancel";
export const FEE_MODE_LABELS: Record<FeeMode, string> = {
  fijo: "Monto fijo por proceso",
  horas: "Por horas",
  porcentaje: "Porcentaje de la cuantía",
  arancel: "Según el arancel oficial",
};

export type ServiceLike = {
  name: string;
  mode: FeeMode;
  amountCents: number | null;
  hourlyRateCents: number | null;
  percentBp: number | null;
  minimumCents: number | null;
  markupBp: number;
  arancelKey: string | null;
  stages: ArancelStage[];
};

export type Suggestion = {
  /** Monto total sugerido (o tarifa por hora si perHour). Null si falta la cuantía. */
  amountCents: number | null;
  perHour: boolean;
  needsBase: boolean;
  explanation: string;
  /** El mínimo del arancel para comparar (si el servicio tiene referencia). */
  arancel: ArancelResult | null;
  /** El monto sugerido queda por debajo del mínimo del arancel. */
  belowArancel: boolean;
};

const money = crc;
const roundColon = (cents: number) => Math.round(cents / 100) * 100;

export function suggestFee(s: ServiceLike, baseCents: number | null, adjustBp = 0): Suggestion {
  const ref = arancelItem(s.arancelKey);
  const arancel = ref ? arancelMinimum(ref, baseCents, adjustBp) : null;
  let amountCents: number | null = null;
  let perHour = false;
  let needsBase = false;
  let explanation = "";

  if (s.mode === "fijo") {
    amountCents = s.amountCents;
    explanation = amountCents ? `Precio del despacho: ${money(amountCents)}.` : "Sin precio definido.";
  } else if (s.mode === "horas") {
    perHour = true;
    amountCents = s.hourlyRateCents;
    explanation = amountCents ? `Tarifa del despacho: ${money(amountCents)} por hora.` : "Sin tarifa por hora definida.";
  } else if (s.mode === "porcentaje") {
    needsBase = true;
    const p = (s.percentBp ?? 0) / 100;
    if (baseCents && baseCents > 0) {
      const raw = roundColon((baseCents * (s.percentBp ?? 0)) / 10000);
      amountCents = Math.max(raw, s.minimumCents ?? 0);
      explanation = `${String(p).replace(".", ",")} % de ${money(baseCents)} = ${money(raw)}${raw < (s.minimumCents ?? 0) ? `; se aplica el mínimo de ${money(s.minimumCents!)}` : ""}.`;
    } else {
      explanation = `${String(p).replace(".", ",")} % de la cuantía${s.minimumCents ? `, mínimo ${money(s.minimumCents)}` : ""}. Indica la cuantía para calcularlo.`;
    }
  } else {
    // Según el arancel, con recargo opcional.
    needsBase = arancel?.needsBase ?? false;
    perHour = !!arancel?.perHour;
    if (arancel?.minCents != null && (!arancel.needsBase || (baseCents ?? 0) > 0)) {
      amountCents = Math.max(roundColon((arancel.minCents * (10000 + s.markupBp)) / 10000), s.minimumCents ?? 0);
      explanation = `${arancel.explanation}${s.markupBp ? ` Recargo del despacho: ${s.markupBp / 100} % → ${money(amountCents)}.` : ""}`;
    } else {
      explanation = arancel ? `${arancel.explanation} Indica la cuantía para calcularlo.` : "Sin referencia del arancel.";
    }
  }

  const belowArancel = amountCents != null && arancel?.minCents != null && (!arancel.needsBase || (baseCents ?? 0) > 0) && amountCents < arancel.minCents && !!arancel.perHour === perHour;
  return { amountCents, perHour, needsBase, explanation, arancel, belowArancel };
}

/** Rendimiento de un expediente por proceso: cuánto se gana por hora efectiva trabajada. */
export function profitability(feeCents: number, minutes: number, hoursValueCents: number) {
  const perHourCents = minutes > 0 ? Math.round((feeCents * 60) / minutes) : null;
  const diffCents = feeCents - hoursValueCents;
  return { perHourCents, diffCents, hoursValueCents, ratio: hoursValueCents > 0 ? feeCents / hoursValueCents : null };
}

/** Lee un porcentaje escrito por la persona («2,5», «2.5 %») en puntos básicos. */
export function parsePercentToBp(raw: string): number | null {
  const t = raw.replace(/%/g, "").trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp >= 0 && bp <= 100_00 ? bp : null;
}

/** «Presentación 50; Sentencia 50» o una línea por etapa → etapas (deben sumar 100). */
export function parseStages(raw: string): { stages: ArancelStage[] } | { error: string } {
  const parts = raw
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const stages: ArancelStage[] = [];
  for (const p of parts) {
    const m = /^(.*?)[\s:=-]+(\d{1,3}(?:[.,]\d{1,2})?)\s*%?$/.exec(p);
    if (!m || !m[1].trim()) return { error: `No entiendo la etapa «${p}». Escribe el nombre y el porcentaje, p. ej. «Presentación 50».` };
    stages.push({ name: m[1].trim().slice(0, 120), percent: Number(m[2].replace(",", ".")) });
  }
  if (stages.length > 10) return { error: "Como máximo 10 etapas." };
  const sum = stages.reduce((s, x) => s + x.percent, 0);
  if (stages.length && Math.abs(sum - 100) > 0.05) return { error: `Las etapas suman ${sum.toLocaleString("es-CR")} %; deben sumar 100 %.` };
  return { stages };
}

export const stagesToText = (stages: ArancelStage[]) => stages.map((s) => `${s.name} ${String(s.percent).replace(".", ",")}`).join("\n");

/**
 * Lee un importe en colones escrito en lenguaje natural: «₡5.000.000», «20 millones», «3,5 millones»,
 * «800 mil», «5000000 colones». Devuelve céntimos, o null si no hay un importe claro.
 */
export function extractAmountCents(text: string): number | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const re = /(?:₡|c\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s*(millones|millon|mil|m\b)?\s*(colones)?/g;
  let best: number | null = null;
  for (const m of t.matchAll(re)) {
    const [all, num, unit, col] = m;
    const hasCurrency = all.trim().startsWith("₡") || !!col;
    let value = num.includes(",") ? Number(num.replace(",", ".")) : Number(num.replace(/[.\s]/g, ""));
    if (!Number.isFinite(value)) continue;
    if (unit === "millones" || unit === "millon" || unit === "m") value *= 1_000_000;
    else if (unit === "mil") value *= 1_000;
    else if (!hasCurrency && value < 10_000) continue; // «2 años», «3 meses», «art. 74»
    if (best === null || value > best) best = value;
  }
  return best === null ? null : Math.round(best) * 100;
}
