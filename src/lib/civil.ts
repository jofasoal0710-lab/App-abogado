/**
 * Prescripción civil (Código Civil, Ley 30 de 1885, versión 22 de SINALEVI: arts. 868 a 880) y plazo del
 * recurso de amparo (Ley de la Jurisdicción Constitucional, Ley 7135, art. 35). Puro: fechas «AAAA-MM-DD».
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

export type CivilClaim = "general" | "periodicas_semestre" | "honorarios" | "obras_destajo" | "uso_muebles" | "periodicas_menor" | "ventas_consumidor" | "artesanos";

export const CIVIL_CLAIMS: Record<CivilClaim, { label: string; years: number; rule: string }> = {
  general: { label: "Regla general (cualquier derecho o acción)", years: 10, rule: "Todo derecho y su acción prescriben a los diez años (CC art. 868)." },
  periodicas_semestre: { label: "Intereses, alquileres, pensiones o rentas pagaderos por semestre o más", years: 3, rule: "Tres años (CC art. 869 inc. 1)." },
  honorarios: { label: "Sueldos, honorarios o emolumentos de servicios profesionales", years: 3, rule: "Tres años (CC art. 869 inc. 2)." },
  obras_destajo: { label: "Obras ejecutadas por destajo (empresarios)", years: 3, rule: "Tres años (CC art. 869 inc. 3)." },
  uso_muebles: { label: "Cobro por el uso u otro derecho sobre bienes muebles", years: 3, rule: "Tres años (CC art. 869 inc. 4)." },
  periodicas_menor: { label: "Intereses, alquileres o rentas pagaderos por períodos menores de un semestre", years: 1, rule: "Un año (CC art. 870 inc. 1)." },
  ventas_consumidor: { label: "Ventas de comerciantes directamente a consumidores", years: 1, rule: "Un año (CC art. 870 inc. 3)." },
  artesanos: { label: "Precio de obras de artesanos", years: 1, rule: "Un año (CC art. 870 inc. 4)." },
};

/** Prescripción negativa (extintiva) de una acción civil. */
export function civilPrescription(i: { claim: CivilClaim; exigibleOn: string; lastInterruptionOn?: string | null; victimAdultOn?: string | null }) {
  const c = CIVIL_CLAIMS[i.claim];
  let start = i.exigibleOn;
  const steps = [c.rule, "Corre desde el día en que la obligación es exigible (CC art. 874)."];
  if (i.claim === "general" && i.victimAdultOn && i.victimAdultOn > start) {
    start = i.victimAdultOn;
    steps.push("Daños y perjuicios a una persona menor de edad: corre desde que cumple la mayoría de edad (CC art. 868).");
  }
  if (i.lastInterruptionOn && i.lastInterruptionOn > start) {
    start = i.lastInterruptionOn;
    steps.push(
      "Se interrumpió: el reconocimiento de la deuda, el emplazamiento, embargo o secuestro notificado y cualquier gestión judicial o extrajudicial de cobro interrumpen la prescripción (arts. 876 y 879), y el tiempo anterior se pierde: vuelve a correr completo desde ese acto (art. 878).",
    );
  }
  steps.push("No corre, entre otros casos, contra menores o incapaces sin representante, ni entre padres e hijos mientras dure la responsabilidad parental (CC art. 880).");
  return { years: c.years, start, due: addMonths(start, c.years * 12), steps };
}

/**
 * Recurso de amparo (LJC art. 35): mientras subsista la violación y hasta dos meses después de que cesen
 * sus efectos directos; si el derecho es puramente patrimonial o renunciable, dos meses desde que el
 * perjudicado tuvo noticia fehaciente y pudo interponerlo.
 */
export function amparoDeadline(i: { from: string; patrimonial?: boolean }) {
  return {
    due: addMonths(i.from, 2),
    rule: i.patrimonial
      ? "Derechos puramente patrimoniales o que se pueden consentir: dentro de los dos meses desde la noticia fehaciente de la violación (LJC art. 35). Fuera de plazo es inadmisible (art. 60)."
      : "Se puede interponer en cualquier momento mientras subsista la violación, y hasta dos meses después de que cesen totalmente sus efectos directos (LJC art. 35). Fuera de plazo es inadmisible (art. 60).",
  };
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** «¿Cuándo prescribe una deuda exigible desde el 01/03/2020?» → tipo de crédito (null si no es prescripción civil). */
export function parseCivilPrescriptionQuestion(question: string): CivilClaim | null {
  const n = fold(question);
  if (!/\bprescri\w*/.test(n)) return null;
  if (/\b(delito|penal|pena|prision|laboral|trabajador|patrono|salario|despido|contravencion\w*)\b/.test(n)) return null;
  if (!/\b(deuda|deudas|credito|obligacion\w*|prestamo|cobro|honorarios|alquiler\w*|arrendamiento|intereses|danos|perjuicios|civil|factura|pagare|accion)\b/.test(n)) return null;
  if (/\bhonorarios\b/.test(n)) return "honorarios";
  if (/\b(alquiler\w*|arrendamiento|intereses|rentas?)\b/.test(n)) return /\bmensual\w*|cada mes\b/.test(n) ? "periodicas_menor" : "periodicas_semestre";
  return "general";
}
