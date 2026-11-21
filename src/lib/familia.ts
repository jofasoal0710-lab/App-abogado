/**
 * Cálculos de familia (Costa Rica), según el texto vigente en SINALEVI:
 *  - Código de Familia (Ley 5476, versión 43): arts. 48, 164, 172, 246.
 *  - Código Procesal de Familia (Ley 9747, versión 4, vigente desde el 1 de octubre de 2024): arts. 271, 279, 280, 283.
 * La Ley de Pensiones Alimentarias (7654) está derogada (Ley 9747, art. 4).
 * Puro: céntimos de colón y fechas «AAAA-MM-DD».
 */

const addMonths = (date: string, months: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};

export type PensionYear = {
  monthlyCents: number;
  ordinaryCents: number;
  aguinaldoCents: number;
  escolarCents: number;
  totalCents: number;
  notes: string[];
};

/**
 * Lo que se paga en un año por una cuota alimentaria: 12 cuotas, el aguinaldo (una cuota igual a la
 * ordinaria en los primeros veinte días de diciembre) y, si procede, el salario escolar o gasto de
 * inicio de lecciones (una cuota igual en enero) — art. 164 del Código de Familia.
 */
export function pensionYear(monthlyCents: number, opts: { escolar?: boolean } = {}): PensionYear {
  const escolar = opts.escolar ? monthlyCents : 0;
  const notes = [
    "Aguinaldo: una cuota igual a la ordinaria, dentro de los primeros veinte días de diciembre, sin necesidad de que se ordene (CF art. 164).",
    opts.escolar
      ? "Salario escolar o inicio de lecciones: una cuota igual a la ordinaria en enero, si el obligado recibe salario escolar y la persona beneficiaria estudia (CF art. 164). El juez puede fijar en cambio un monto anual."
      : "Sin cuota de salario escolar (solo procede si el obligado lo recibe y la persona beneficiaria tiene gastos de estudio).",
    "La cuota se actualiza sola: si el obligado es asalariado, en enero y julio según el aumento de ley; si no, cada enero según la variación del salario base (CPF art. 279).",
  ];
  return { monthlyCents, ordinaryCents: monthlyCents * 12, aguinaldoCents: monthlyCents, escolarCents: escolar, totalCents: monthlyCents * 13 + escolar, notes };
}

/**
 * Deuda alimentaria y apremio corporal (CPF art. 283): el apremio procede hasta por seis mensualidades
 * (incluida la presente), más aguinaldo, salario escolar y gastos extraordinarios urgentes; la primera
 * orden es hasta por dos meses, la segunda hasta cuatro y desde la tercera hasta seis.
 */
export function alimonyArrears(input: { monthlyCents: number; monthsOwed: number; extrasCents?: number; order?: number }) {
  const months = Math.max(0, Math.floor(input.monthsOwed));
  const owed = input.monthlyCents * months + (input.extrasCents ?? 0);
  const apremioMonths = Math.min(months, 6);
  const apremioCents = input.monthlyCents * apremioMonths + (input.extrasCents ?? 0);
  const order = Math.max(1, input.order ?? 1);
  const maxDetentionMonths = order === 1 ? 2 : order === 2 ? 4 : 6;
  return {
    owedCents: owed,
    apremioCents,
    apremioMonths,
    beyondApremioCents: owed - apremioCents,
    maxDetentionMonths,
    notes: [
      `Con apremio corporal se pueden cobrar hasta seis mensualidades (incluida la presente) más aguinaldo, salario escolar y gastos extraordinarios urgentes: aquí ${apremioMonths} ${apremioMonths === 1 ? "cuota" : "cuotas"} (CPF art. 283).`,
      `Orden de apremio n.° ${order}: hasta ${maxDetentionMonths} meses (la primera hasta 2, la segunda hasta 4 y desde la tercera hasta 6).`,
      "Solo contra la persona deudora mayor de edad y menor de sesenta y cinco años (CPF art. 283); lo que exceda puede cobrarse por la vía de ejecución, por ejemplo con embargo de bienes.",
    ],
  };
}

/** Reconocimiento de unión de hecho: la acción caduca a los dos años de la ruptura o de la muerte (CF art. 246). */
export function unionCaducity(endedOn: string) {
  return { due: addMonths(endedOn, 24), rule: "La acción caduca en dos años desde la ruptura de la convivencia o la muerte del conviviente (CF art. 246). La unión debe ser pública, notoria, única y estable por más de dos años (art. 245)." };
}

/** Convenio de divorcio por mutuo consentimiento: presentarlo ante el juzgado dentro de los tres meses siguientes a la escritura (CF art. 48), salvo que lo presenten ambos cónyuges juntos. */
export function divorceAgreementDeadline(signedOn: string) {
  return { due: addMonths(signedOn, 3), rule: "Con hijos menores o bienes en el convenio, se presenta al juzgado dentro de los tres meses siguientes a la escritura, salvo que lo presenten ambos cónyuges juntos; sin hijos menores ni bienes, va directo al Registro Civil (CF art. 48)." };
}

/** Alimentos pasados: solo los doce meses anteriores a la demanda y si hubo que endeudarse para vivir (CF art. 172). */
export const PAST_ALIMONY_MONTHS = 12;
