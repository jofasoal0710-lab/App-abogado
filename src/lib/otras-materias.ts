import { isBusinessDayCR } from "./cr-holidays";

/**
 * Calculadoras de derecho administrativo, tránsito, comercial, arrendamientos y tributario (Costa Rica),
 * según el texto vigente en SINALEVI (noviembre de 2026): LGAP (Ley 6227, v22), CPCA (Ley 8508, v8),
 * Ley de Tránsito (Ley 9078, v31), Código de Comercio (Ley 3284, v31), Ley 7527 (v12) y CNPT (Ley 4755, v22).
 * Puro: fechas «AAAA-MM-DD» y céntimos de colón.
 */
const day = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Suma meses de fecha a fecha (si el día no existe, el último del mes). */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = (((total % 12) + 12) % 12) + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${String(tm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** N días hábiles contados desde el día siguiente a `from` (el primero ya cuenta si es hábil). */
export function businessDaysAfter(from: string, n: number): string {
  let d = from;
  let count = 0;
  while (count < n) {
    d = day(d, 1);
    if (isBusinessDayCR(d)) count++;
  }
  return d;
}

/* ---------------- Administrativo ---------------- */

/** Recursos ordinarios de la LGAP: tres días hábiles contra el acto final (art. 346; días hábiles, art. 256). */
export function administrativeAppeal(notifiedOn: string) {
  return {
    due: businessDaysAfter(notifiedOn, 3),
    rule: "Revocatoria y apelación contra el acto final: tres días hábiles desde el día siguiente a la notificación (LGAP arts. 346 y 256). Contra los demás actos recurribles: veinticuatro horas.",
  };
}

/** Plazo para demandar en lo contencioso: un año desde el día siguiente a la notificación (CPCA art. 39). */
export function contentiousDeadline(notifiedOn: string) {
  const due = addMonthsISO(notifiedOn, 12);
  return {
    due,
    nonWorking: !isBusinessDayCR(due),
    rule: "Un año desde el día siguiente a la notificación del acto, o a la última publicación (CPCA art. 39). Si el acto es absolutamente nulo o la omisión tiene efectos continuados, el año corre desde que cesan sus efectos (art. 40).",
  };
}

/** Silencio positivo: un mes desde que el órgano recibe la solicitud completa (LGAP art. 331). */
export function positiveSilence(receivedOn: string) {
  return { due: addMonthsISO(receivedOn, 1), rule: "En permisos, licencias y autorizaciones, si no hay respuesta en un mes desde la solicitud con todos los requisitos, se entiende otorgada (LGAP arts. 330 y 331)." };
}

/** Boleta de tránsito: impugnación en diez días hábiles desde el día siguiente a su confección (Ley 9078 art. 163). */
export function trafficTicketAppeal(issuedOn: string) {
  return {
    due: businessDaysAfter(issuedOn, 10),
    actionPrescribes: addMonthsISO(issuedOn, 24),
    rule: "Diez días hábiles improrrogables desde el día siguiente a la confección de la boleta, ante la Unidad de Impugnaciones del Cosevi (Ley 9078 art. 163). La acción por multa fija prescribe en dos años desde la boleta (art. 190).",
  };
}

/* ---------------- Comercial ---------------- */

export const COMMERCIAL_CLAIMS = {
  general: { label: "Obligación comercial en general", years: 4, ref: "CCom art. 984" },
  letra: { label: "Letra de cambio o pagaré", years: 4, ref: "CCom arts. 795 y 802" },
  intereses: { label: "Intereses, alquileres o rentas", years: 1, ref: "CCom art. 984 b)" },
  nulidad_asamblea: { label: "Nulidad de acuerdos de asamblea o junta directiva", years: 1, ref: "CCom art. 984 a)" },
  vicios_garantia: { label: "Vicios de cosa vendida con garantía de buen funcionamiento", years: 1, ref: "CCom art. 984 a)" },
  administradores: { label: "Responsabilidad de administradores, gerentes y directores", years: 1, ref: "CCom art. 984 a)" },
  destajo: { label: "Cobro de obras por destajo", years: 1, ref: "CCom art. 984 c)" },
} as const;
export type CommercialClaim = keyof typeof COMMERCIAL_CLAIMS;

/**
 * Prescripción mercantil: corre desde el día siguiente al vencimiento (art. 969/983), por años de fecha a fecha
 * (art. 982); la interrupción anula el tiempo transcurrido y empieza uno nuevo (arts. 977 y 981).
 */
export function commercialPrescription(input: { claim: CommercialClaim; dueOn: string; interruptedOn?: string }) {
  const c = COMMERCIAL_CLAIMS[input.claim];
  const from = input.interruptedOn && input.interruptedOn > input.dueOn ? input.interruptedOn : input.dueOn;
  return {
    years: c.years,
    from,
    due: addMonthsISO(from, c.years * 12),
    rule: `${c.label}: ${c.years === 1 ? "un año" : "cuatro años"} (${c.ref}), de fecha a fecha desde el vencimiento.${input.interruptedOn && input.interruptedOn > input.dueOn ? " Se interrumpió: el tiempo anterior se anula y el plazo corre de nuevo desde la interrupción (arts. 977 y 981)." : ""}`,
  };
}

/* ---------------- Arrendamientos ---------------- */

/**
 * Plazo del arrendamiento (mínimo tres años desde la entrega, art. 70) y prórrogas tácitas de tres años
 * (art. 71): devuelve el período en curso a la fecha `on` y el último día para avisar que no se renueva.
 */
export function leaseTerm(deliveredOn: string, on: string) {
  let start = deliveredOn;
  let end = addMonthsISO(deliveredOn, 36);
  let renewals = 0;
  while (end <= on) {
    start = end;
    end = addMonthsISO(end, 36);
    renewals++;
  }
  return {
    start,
    end,
    renewals,
    noticeBy: addMonthsISO(end, -3),
    rule: "Mínimo tres años desde que el inquilino recibe el bien (Ley 7527 art. 70). Si el arrendador no avisa que no renovará al menos tres meses antes del vencimiento, se prorroga por otros tres años (art. 71). El inquilino puede terminarlo avisando con tres meses (art. 72).",
  };
}

/** Reajuste anual del alquiler de vivienda (Ley 7527 art. 67). `inflationBp`: inflación de 12 meses en puntos básicos. */
export function housingRentIncrease(rentCents: number, inflationBp: number) {
  const capped = inflationBp <= 1000;
  const maxBp = Math.max(0, inflationBp);
  return {
    capped,
    maxRentCents: capped ? Math.round((rentCents * (10000 + maxBp)) / 10000) : null,
    minIfMivahCents: capped ? null : Math.round((rentCents * 11000) / 10000),
    maxIfMivahCents: capped ? null : Math.round((rentCents * (10000 + maxBp)) / 10000),
    rule: capped
      ? "Inflación de 12 meses del 10 % o menos: el aumento puede ser, como máximo, esa inflación (índice de precios al consumidor del INEC) (Ley 7527 art. 67 a)."
      : "Inflación mayor al 10 %: el MIVAH fija el porcentaje, entre el 10 % y la inflación anual (Ley 7527 art. 67 b). Es nulo pactar aumentos mayores (art. 68).",
  };
}

/* ---------------- Tributario ---------------- */

/**
 * Prescripción tributaria (CNPT arts. 51 y 52): cuatro años (diez si no está inscrito, no declaró o la
 * declaración fue fraudulenta), contados desde el primer día del mes siguiente a la fecha en que debía pagarse.
 */
export function taxPrescription(input: { paymentDueOn: string; tenYears?: boolean }) {
  const [y, m] = input.paymentDueOn.split("-").map(Number);
  const from = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const years = input.tenYears ? 10 : 4;
  return {
    from,
    years,
    due: addMonthsISO(from, years * 12),
    rule: `${years} años desde el ${from.split("-").reverse().join("/")}, primer día del mes siguiente a la fecha de pago (CNPT arts. 51 y 52). Se interrumpe, entre otras causas, con la notificación del inicio de la fiscalización (art. 53); si se recurre, el nuevo plazo corre desde el 1 de enero siguiente a la firmeza (art. 54).`,
  };
}

/* ---------------- Asistente: preguntas de prescripción de estas materias ---------------- */

const foldText = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export type OtherPrescription =
  | { area: "comercial"; claim: CommercialClaim }
  | { area: "tributario"; tenYears: boolean }
  | { area: "transito" };

/** «¿Cuándo prescribe una letra de cambio…?», «prescripción de un impuesto», «¿prescribe la multa de tránsito?». */
export function parseOtherPrescriptionQuestion(question: string): OtherPrescription | null {
  const n = foldText(question);
  if (!/\bprescri\w*/.test(n)) return null;
  if (/\b(tribut\w*|impuestos?|hacienda|renta|iva|fisco|fiscal)\b/.test(n) && !/\b(delito|penal)\b/.test(n))
    return { area: "tributario", tenYears: /\b(no (?:estaba |esta |estar )?inscrit\w*|sin inscribir|no (?:presento |presentaba )?declar\w*|sin declarar|fraud\w*)\b/.test(n) };
  if (/\b(multa de transito|boleta|transito|cosevi)\b/.test(n)) return { area: "transito" };
  if (/\b(letra de cambio|letras de cambio|pagare\w*)\b/.test(n)) return { area: "comercial", claim: "letra" };
  if (/\b(mercantil\w*|comercial\w*|sociedad\w*|asamblea\w*|accionistas?|comerciante)\b/.test(n)) {
    if (/\b(nulidad|acuerdos?|asamblea\w*)\b/.test(n)) return { area: "comercial", claim: "nulidad_asamblea" };
    if (/\b(administrador\w*|gerentes?|directores?)\b/.test(n)) return { area: "comercial", claim: "administradores" };
    if (/\b(intereses|alquiler\w*|rentas?|arrendamientos?)\b/.test(n)) return { area: "comercial", claim: "intereses" };
    return { area: "comercial", claim: "general" };
  }
  return null;
}
