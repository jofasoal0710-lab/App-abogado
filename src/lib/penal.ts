/**
 * Cálculos penales (Costa Rica), según el texto vigente en SINALEVI:
 *  - Prescripción de la acción penal: Código Procesal Penal (Ley 7594, versión 47) arts. 31 a 34.
 *  - Prescripción de la pena: Código Penal (Ley 4573, versión 104) arts. 84 y 86.
 * Puro: sin base de datos. Las fechas son «AAAA-MM-DD».
 */

export type PenaltyKind =
  /** Delito sancionado con prisión (art. 31 a): el máximo de la pena, entre 3 y 10 años. */
  | "prision"
  /** Delito con penas no privativas de libertad, falta o contravención (art. 31 b): 2 años. */
  | "no_privativa"
  /** Delito cometido por una persona jurídica (art. 31 b): 10 años. */
  | "persona_juridica"
  /** Delito sexual contra persona menor de edad (art. 31 c): 25 años desde que la víctima cumple 18. */
  | "sexual_menor"
  /** Corrupción (Ley 8422) o delitos contra los deberes de la función pública (título XV CP) (art. 31 d): 30 años. */
  | "funcion_publica";

export const PENALTY_KIND_LABELS: Record<PenaltyKind, string> = {
  prision: "Delito sancionado con prisión",
  no_privativa: "Pena no privativa de libertad, falta o contravención",
  persona_juridica: "Delito cometido por una persona jurídica",
  sexual_menor: "Delito sexual contra persona menor de edad",
  funcion_publica: "Corrupción o delito contra los deberes de la función pública",
};

const addYears = (date: string, years: number) => {
  const whole = Math.floor(years);
  const months = Math.round((years - whole) * 12);
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + whole);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 29 de febrero o día 31 en un mes más corto: último día del mes.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};
const fmtYears = (y: number) => {
  const whole = Math.floor(y);
  const months = Math.round((y - whole) * 12);
  return [whole ? `${whole} ${whole === 1 ? "año" : "años"}` : "", months ? `${months} ${months === 1 ? "mes" : "meses"}` : ""].filter(Boolean).join(" y ") || "0 años";
};

export type PrescriptionInput = {
  kind: PenaltyKind;
  /** Máximo de la pena de prisión del delito, en años (solo «prision»). */
  maxPenaltyYears?: number;
  /** Consumación del hecho, último acto de la tentativa o cese del delito continuo (art. 32). */
  committedOn: string;
  /** Si la víctima era menor de edad: fecha en que cumplió o cumplirá 18 años (art. 31 a y c). */
  victimAdultOn?: string | null;
  /** Último acto que interrumpió la prescripción (art. 33): indagatoria, querella, audiencia preliminar, señalamiento de debate, sentencia… */
  lastInterruptionOn?: string | null;
};

export type PrescriptionResult = {
  years: number;
  /** Desde cuándo corre el plazo completo. */
  start: string;
  /** Vencimiento sin actos de interrupción. */
  due: string;
  /** Con la última interrupción: el plazo se reduce a la mitad y corre de nuevo (art. 33). */
  dueAfterInterruption: string | null;
  steps: string[];
};

/** Prescripción de la acción penal (arts. 31 a 33 del CPP). No incluye las suspensiones del art. 34. */
export function actionPrescription(i: PrescriptionInput): PrescriptionResult {
  const steps: string[] = [];
  let years: number;
  let start = i.committedOn;
  switch (i.kind) {
    case "prision": {
      const max = Math.max(0, i.maxPenaltyYears ?? 0);
      years = Math.min(10, Math.max(3, max));
      steps.push(`Delito con prisión: el plazo es igual al máximo de la pena (${fmtYears(max)}), sin bajar de 3 ni pasar de 10 años → ${fmtYears(years)} (CPP art. 31 a).`);
      if (i.victimAdultOn && i.victimAdultOn > start) {
        start = i.victimAdultOn;
        steps.push(`La víctima era menor de edad: el plazo empieza a correr cuando cumple la mayoría de edad (${start}).`);
      }
      break;
    }
    case "no_privativa":
      years = 2;
      steps.push("Penas no privativas de libertad, faltas o contravenciones: 2 años (CPP art. 31 b).");
      break;
    case "persona_juridica":
      years = 10;
      steps.push("Delito cometido por una persona jurídica: 10 años (CPP art. 31 b).");
      break;
    case "sexual_menor":
      years = 25;
      if (i.victimAdultOn) start = i.victimAdultOn;
      steps.push(`Delito sexual contra persona menor de edad: 25 años desde que la víctima cumplió la mayoría de edad${i.victimAdultOn ? ` (${i.victimAdultOn})` : " (indica esa fecha)"} (CPP art. 31 c).`);
      break;
    case "funcion_publica":
      years = 30;
      steps.push("Corrupción (Ley 8422) o delitos contra los deberes de la función pública: 30 años desde la consumación (CPP art. 31 d).");
      break;
  }
  steps.push("Corre desde la consumación; en la tentativa, desde el último acto de ejecución; en el delito continuo o permanente, desde que cesó (CPP art. 32).");
  const due = addYears(start, years);
  let dueAfterInterruption: string | null = null;
  if (i.lastInterruptionOn) {
    dueAfterInterruption = addYears(i.lastInterruptionOn, years / 2);
    steps.push(
      `Iniciado el procedimiento, el plazo se reduce a la mitad (${fmtYears(years / 2)}) y vuelve a correr con cada acto interruptor; desde el último (${i.lastInterruptionOn}) vence el ${dueAfterInterruption} (CPP art. 33).`,
    );
  }
  steps.push("Se suspende mientras la acción no pueda promoverse, durante un criterio de oportunidad o una suspensión del proceso a prueba, por rebeldía, etc. (CPP art. 34): esos periodos se suman.");
  return { years, start, due, dueAfterInterruption, steps };
}

/** Prescripción de la pena impuesta (CP arts. 84 y 86): la condena más un tercio, entre 3 y 25 años. */
export function penaltyPrescription(input: { sentenceYears: number; kind?: "prision" | "multa" | "contravencion"; firmOn: string }) {
  const kind = input.kind ?? "prision";
  let years: number;
  let rule: string;
  if (kind === "multa") {
    years = 3;
    rule = "Días multa impuestos por un delito: 3 años (CP art. 84 inc. 2).";
  } else if (kind === "contravencion") {
    years = 1;
    rule = "Contravenciones: 1 año (CP art. 84 inc. 3).";
  } else {
    const raw = input.sentenceYears * (4 / 3);
    years = Math.min(25, Math.max(3, raw));
    rule = `Prisión: la condena (${fmtYears(input.sentenceYears)}) más un tercio = ${fmtYears(raw)}, sin bajar de 3 ni pasar de 25 años → ${fmtYears(years)} (CP art. 84 inc. 1).`;
  }
  return { years, due: addYears(input.firmOn, years), rule, from: "Corre desde que la sentencia queda firme, o desde que se revoca la ejecución condicional o se quebranta la condena (CP art. 86)." };
}

export { fmtYears };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * «¿Cuándo prescribe un delito con pena máxima de 6 años cometido el 01/03/2022?» → datos para el cálculo.
 * Devuelve null si la pregunta no es sobre la prescripción penal o falta la pena.
 */
export function parsePrescriptionQuestion(question: string): { kind: PenaltyKind; maxPenaltyYears?: number } | null {
  const n = fold(question);
  if (!/\bprescri\w*/.test(n) || !/\b(delito|penal|pena|prision|contravencion\w*|falta|corrupcion|peculado|cohecho)\b/.test(n)) return null;
  if (/\bcontravencion\w*|\bfaltas?\b/.test(n)) return { kind: "no_privativa" };
  if (/\bpersona juridica\b/.test(n)) return { kind: "persona_juridica" };
  if (/\b(corrupcion|peculado|cohecho|funcion publica|enriquecimiento ilicito)\b/.test(n)) return { kind: "funcion_publica" };
  const m = /(\d{1,2}(?:[.,]\d+)?)\s*anos?\b/.exec(n);
  if (!m) return null;
  return { kind: "prision", maxPenaltyYears: Number(m[1].replace(",", ".")) };
}
