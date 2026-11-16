/** Reglas de las facturas rectificativas (puras). El método es «por diferencias»: la original no se toca. */

export const INVOICE_PREFIX = "FAC";
/** Serie especial exigida a las facturas rectificativas. */
export const RECTIFICATION_PREFIX = "RECT";

/** Solo se rectifica una factura ya emitida que no sea ella misma una rectificativa. */
export function canRectify(inv: { kind: "factura" | "rectificativa"; status: string }): boolean {
  return inv.kind === "factura" && (inv.status === "emitida" || inv.status === "pagada");
}

/** Copia de las líneas con el precio cambiado de signo: un abono total. */
export function negateItems<T extends { unitPriceCents: number }>(items: readonly T[]): T[] {
  return items.map((it) => ({ ...it, unitPriceCents: -it.unitPriceCents }));
}

/**
 * ¿Dejaría esta rectificativa la factura por debajo de cero? No se puede abonar más de lo facturado
 * (contando las demás rectificativas ya emitidas).
 */
export function exceedsOriginal(originalTotalCents: number, otherRectificationTotalsCents: readonly number[], newRectificationTotalCents: number): boolean {
  const net = originalTotalCents + otherRectificationTotalsCents.reduce((s, c) => s + c, 0) + newRectificationTotalCents;
  return net < 0;
}
