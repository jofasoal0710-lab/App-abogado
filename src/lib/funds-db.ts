import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { matterExpenses, matterFunds, matters } from "@/db/schema";
import { ACCESS_DENIED } from "./access-rules";
import { checkWithdrawal, fundBalance } from "./funds";
import type { Db } from "./invoice-queries";

/**
 * Bloquea el expediente (FOR UPDATE) y devuelve el saldo de su provisión. Todo movimiento que saque dinero
 * se hace dentro de la misma transacción, así dos salidas simultáneas no pueden dejarlo en negativo.
 */
export async function lockFundBalance(tx: Db, matterId: number): Promise<number | null> {
  const [m] = await tx.select({ id: matters.id }).from(matters).where(eq(matters.id, matterId)).for("update");
  if (!m) return null;
  const rows = await tx.select({ kind: matterFunds.kind, amountCents: matterFunds.amountCents }).from(matterFunds).where(eq(matterFunds.matterId, matterId));
  return fundBalance(rows);
}

export function fundMovements(dbx: Db, matterId: number) {
  return dbx.select().from(matterFunds).where(eq(matterFunds.matterId, matterId)).orderBy(asc(matterFunds.movedOn), asc(matterFunds.id));
}

/** Saldo de la provisión por expediente (solo los que tienen movimientos). */
export const fundBalanceSql = sql<number>`coalesce(sum(case when ${matterFunds.kind} = 'deposito' then ${matterFunds.amountCents} else -${matterFunds.amountCents} end), 0)::float8`;

/** Error de negocio de la provisión (se muestra tal cual al usuario). */
export class FundError extends Error {}

/** Registra un gasto y lo paga con la provisión (queda reembolsado en el acto). Dentro de una transacción. */
export async function payExpenseFromFunds(
  tx: Db,
  matterId: number,
  userId: number,
  expense: { kind: "timbre" | "registro" | "gasto" | "viaticos"; description: string; amountCents: number; spentOn: string },
) {
  const balance = await lockFundBalance(tx, matterId);
  if (balance === null) throw new FundError(ACCESS_DENIED);
  const err = checkWithdrawal(balance, expense.amountCents);
  if (err) throw new FundError(err);
  const [e] = await tx.insert(matterExpenses).values({ ...expense, matterId, createdById: userId, reimbursedAt: expense.spentOn }).returning({ id: matterExpenses.id });
  await tx.insert(matterFunds).values({ matterId, kind: "gasto", amountCents: expense.amountCents, movedOn: expense.spentOn, description: expense.description, expenseId: e.id, createdById: userId });
}
