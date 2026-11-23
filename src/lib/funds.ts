/**
 * Provisión de fondos del expediente: dinero que el cliente entrega por adelantado para gastos y
 * honorarios. Lógica pura (sin base de datos): saldo, saldo acumulado por movimiento y avisos.
 */
export const FUND_KINDS = {
  deposito: "Depósito del cliente",
  gasto: "Gasto pagado con la provisión",
  aplicacion: "Aplicado a una factura",
  devolucion: "Devolución al cliente",
} as const;
export type FundKind = keyof typeof FUND_KINDS;

/** +1 si el movimiento aumenta el saldo, −1 si lo reduce. */
export const fundSign = (kind: FundKind) => (kind === "deposito" ? 1 : -1);

export type FundMovement = { kind: FundKind; amountCents: number };

export function fundBalance(rows: readonly FundMovement[]): number {
  return rows.reduce((s, r) => s + fundSign(r.kind) * r.amountCents, 0);
}

/** Saldo tras cada movimiento (en el orden dado: del más antiguo al más reciente). */
export function runningBalances<T extends FundMovement>(rows: readonly T[]): (T & { balanceCents: number })[] {
  let bal = 0;
  return rows.map((r) => ({ ...r, balanceCents: (bal += fundSign(r.kind) * r.amountCents) }));
}

/** Una salida no puede dejar el saldo en negativo (el despacho no adelanta dinero desde la provisión). */
export function checkWithdrawal(balanceCents: number, amountCents: number): string | null {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return "El importe debe ser mayor que cero.";
  if (amountCents > balanceCents) return `La provisión no alcanza: el saldo disponible es menor que el importe.`;
  return null;
}

/** Borrar un depósito no puede dejar en negativo lo que ya se gastó o aplicó con él. */
export function checkDepositRemoval(balanceCents: number, depositCents: number): string | null {
  return depositCents > balanceCents ? "No se puede borrar: parte de ese depósito ya se usó. Borra antes el gasto o el cobro que lo usó." : null;
}

export type FundsStatus = "sin_movimientos" | "ok" | "bajo" | "agotado";

/** Estado del saldo para los avisos: «bajo» si hay un mínimo y el saldo no lo alcanza. */
export function fundsStatus(balanceCents: number, minCents: number | null, hasMovements: boolean): FundsStatus {
  if (!hasMovements) return "sin_movimientos";
  if (balanceCents <= 0) return "agotado";
  if (minCents != null && balanceCents < minCents) return "bajo";
  return "ok";
}

/** Cuánto se puede aplicar a una factura: lo que falte por cobrar, sin pasar del saldo. */
export const maxApplicable = (balanceCents: number, outstandingCents: number) => Math.max(0, Math.min(balanceCents, outstandingCents));
