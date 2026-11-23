"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invoices, matterFunds, matters, payments } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requirePermission } from "@/lib/auth";
import { stampSessionActor } from "@/lib/data-audit";
import { todayISO } from "@/lib/dates";
import { checkDepositRemoval, checkWithdrawal } from "@/lib/funds";
import { FundError, lockFundBalance } from "@/lib/funds-db";
import { netTotal, reconcileStatus } from "@/lib/invoice-queries";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

const refresh = (matterId: number, invoiceId?: number) => {
  revalidatePath(`/expedientes/${matterId}`);
  revalidatePath("/reportes");
  if (invoiceId) revalidatePath(`/facturas/${invoiceId}`);
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida");
const METHODS = ["transferencia", "tarjeta", "efectivo", "cheque", "otro"] as const;
const movementSchema = z.object({
  amountCents: z.number({ error: "El importe no es válido" }).int().positive("El importe debe ser mayor que cero"),
  movedOn: isoDate,
  description: z.string().min(2, "Escribe un concepto").max(300),
  method: z.enum(METHODS, { error: "Elige cómo se recibió o devolvió" }).nullable(),
  reference: z.string().max(200).nullable(),
});

function parseMovement(formData: FormData, defaultDescription: string) {
  const amount = parseMoneyToCents(str(formData, "amount"));
  return movementSchema.safeParse({
    amountCents: amount ?? undefined,
    movedOn: str(formData, "movedOn") || todayISO(),
    description: str(formData, "description") || defaultDescription,
    method: str(formData, "method") || null,
    reference: optStr(formData, "reference"),
  });
}

async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    return { ok: await fn() };
  } catch (err) {
    if (err instanceof FundError) return { error: err.message };
    throw err;
  }
}

/** El cliente entrega dinero a cuenta (provisión de fondos). */
export async function depositFundsAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.cobros");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const parsed = parseMovement(formData, "Provisión de fondos");
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const res = await run(() =>
    db.transaction(async (tx) => {
      await stampSessionActor(tx);
      if ((await lockFundBalance(tx, matterId)) === null) throw new FundError(ACCESS_DENIED);
      await tx.insert(matterFunds).values({ ...parsed.data, matterId, kind: "deposito", method: parsed.data.method ?? "transferencia", createdById: user.id });
      return `Depósito de ${formatMoney(parsed.data.amountCents)} registrado.`;
    }),
  );
  refresh(matterId);
  return res;
}

/** Se devuelve al cliente lo que sobra de la provisión. */
export async function refundFundsAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.cobros");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const parsed = parseMovement(formData, "Devolución del saldo al cliente");
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const res = await run(() =>
    db.transaction(async (tx) => {
      await stampSessionActor(tx);
      const balance = await lockFundBalance(tx, matterId);
      if (balance === null) throw new FundError(ACCESS_DENIED);
      const err = checkWithdrawal(balance, parsed.data.amountCents);
      if (err) throw new FundError(err);
      await tx.insert(matterFunds).values({ ...parsed.data, matterId, kind: "devolucion", method: parsed.data.method ?? "transferencia", createdById: user.id });
      return `Devolución de ${formatMoney(parsed.data.amountCents)} registrada.`;
    }),
  );
  refresh(matterId);
  return res;
}

/**
 * Paga una factura emitida del expediente con la provisión: registra un cobro («Provisión de fondos») y
 * su salida en el libro, en la misma transacción. Si se borra el cobro, el dinero vuelve a la provisión.
 */
export async function applyFundsToInvoiceAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.cobros");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const invoiceId = Number(str(formData, "invoiceId")) || 0;
  const amount = parseMoneyToCents(str(formData, "amount"));
  if (!invoiceId) return { error: "Elige la factura." };
  if (amount === null || amount <= 0) return { error: "El importe no es válido." };
  const res = await run(() =>
    db.transaction(async (tx) => {
      await stampSessionActor(tx);
      const balance = await lockFundBalance(tx, matterId);
      if (balance === null) throw new FundError(ACCESS_DENIED);
      const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
      if (!inv || inv.matterId !== matterId) throw new FundError("Esa factura no es de este expediente.");
      if (inv.kind !== "factura" || inv.status !== "emitida") throw new FundError("Solo se puede pagar una factura emitida y pendiente de cobro.");
      const net = (await netTotal(tx, invoiceId)) ?? 0;
      const paid = (await tx.select({ a: payments.amountCents }).from(payments).where(eq(payments.invoiceId, invoiceId))).reduce((s, p) => s + p.a, 0);
      if (amount > net - paid) throw new FundError(`El importe supera lo pendiente de la factura (${formatMoney(Math.max(0, net - paid))}).`);
      const err = checkWithdrawal(balance, amount);
      if (err) throw new FundError(err);
      const today = todayISO();
      const [p] = await tx.insert(payments).values({ invoiceId, amountCents: amount, paidAt: today, method: "provision", reference: "Provisión de fondos del expediente" }).returning({ id: payments.id });
      await tx.insert(matterFunds).values({ matterId, kind: "aplicacion", amountCents: amount, movedOn: today, description: `Pago de la factura ${inv.number}`, paymentId: p.id, createdById: user.id });
      await reconcileStatus(tx, invoiceId);
      return `Se aplicaron ${formatMoney(amount)} de la provisión a la factura ${inv.number}.`;
    }),
  );
  refresh(matterId, invoiceId);
  return res;
}


/**
 * Borra un depósito o una devolución mal registrados. Los gastos y los cobros se quitan desde su origen
 * (borrando el gasto o el cobro). Un depósito ya usado no se puede borrar.
 */
export async function deleteFundMovementAction(movementId: number, matterId: number, _prev: ActionState): Promise<ActionState> {
  const user = await requirePermission("facturacion.emitir");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const res = await run(() =>
    db.transaction(async (tx) => {
      await stampSessionActor(tx);
      const balance = await lockFundBalance(tx, matterId);
      if (balance === null) throw new FundError(ACCESS_DENIED);
      const [m] = await tx.select().from(matterFunds).where(and(eq(matterFunds.id, movementId), eq(matterFunds.matterId, matterId), inArray(matterFunds.kind, ["deposito", "devolucion"])));
      if (!m) throw new FundError("Ese movimiento no se puede borrar desde aquí: borra el gasto o el cobro que lo originó.");
      if (m.kind === "deposito") {
        const err = checkDepositRemoval(balance, m.amountCents);
        if (err) throw new FundError(err);
      }
      await tx.delete(matterFunds).where(eq(matterFunds.id, movementId));
      return "Movimiento borrado.";
    }),
  );
  refresh(matterId);
  return res;
}

/** Saldo mínimo de la provisión: por debajo, el expediente y los reportes avisan. Vacío = sin aviso. */
export async function setFundsMinAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.cobros");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const raw = str(formData, "min");
  const min = raw === "" ? null : parseMoneyToCents(raw);
  if (raw !== "" && (min === null || min < 0)) return { error: "El saldo mínimo no es válido." };
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(matters).set({ fundsMinCents: min }).where(eq(matters.id, matterId));
  });
  refresh(matterId);
  return { ok: min === null ? "Sin aviso de saldo mínimo." : `Se avisará cuando el saldo baje de ${formatMoney(min)}.` };
}
