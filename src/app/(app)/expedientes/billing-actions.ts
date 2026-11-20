"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { matterExpenses, matterFeeStages, matters } from "@/db/schema";
import { firstZodError, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseStages } from "@/lib/fees";
import { parseMoneyToCents } from "@/lib/money";
import { replaceMatterStages } from "@/lib/tariff";

const refresh = (matterId: number) => revalidatePath(`/expedientes/${matterId}`);

/** Reparte los honorarios del proceso en etapas (solo si aún no se ha facturado ninguna). */
export async function setStagesAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.emitir");
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter) return { error: ACCESS_DENIED };
  const parsed = parseStages(str(formData, "stages"));
  if ("error" in parsed) return { error: parsed.error };
  return db.transaction(async (tx) => {
    // Se bloquea el expediente: dos cambios simultáneos de etapas no se mezclan.
    const [m] = await tx.select({ billingType: matters.billingType, fee: matters.fixedFeeCents }).from(matters).where(eq(matters.id, matterId)).for("update");
    if (m.billingType !== "tarifa_fija" || !m.fee) return { error: "Las etapas solo se usan cuando se cobra por proceso con un monto total." };
    const billed = await tx.select({ id: matterFeeStages.id }).from(matterFeeStages).where(and(eq(matterFeeStages.matterId, matterId), isNotNull(matterFeeStages.invoiceId))).limit(1);
    if (billed.length) return { error: "Ya hay etapas facturadas: no se pueden rehacer. Si hace falta, corrige la factura con una rectificativa." };
    await replaceMatterStages(tx, matterId, m.fee, parsed.stages);
    refresh(matterId);
    return { ok: parsed.stages.length ? `Honorarios repartidos en ${parsed.stages.length} etapas.` : "Se cobrará en un solo pago." };
  });
}

const expenseSchema = z.object({
  kind: z.enum(["timbre", "registro", "gasto", "viaticos"]),
  description: z.string().min(2, "Describe el gasto").max(300),
  amountCents: z.number().int().positive("El importe debe ser mayor que cero"),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
});

/** Registra un gasto, timbre o derecho de registro (se cobra aparte de los honorarios). */
export async function addExpenseAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("facturacion.ver");
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const amount = parseMoneyToCents(str(formData, "amount"));
  if (amount === null) return { error: "El importe no es válido." };
  const parsed = expenseSchema.safeParse({ kind: str(formData, "kind"), description: str(formData, "description"), amountCents: amount, spentOn: str(formData, "spentOn") || todayISO() });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  await db.insert(matterExpenses).values({ ...parsed.data, matterId, createdById: user.id });
  refresh(matterId);
  return { ok: "Gasto registrado." };
}

/** Marca un gasto como reembolsado por el cliente (o lo vuelve a dejar pendiente). */
export async function toggleExpenseAction(expenseId: number, matterId: number) {
  const user = await requirePermission("facturacion.ver");
  if (!(await getAccessibleMatter(user, matterId))) return;
  const [e] = await db.select({ reimbursedAt: matterExpenses.reimbursedAt }).from(matterExpenses).where(and(eq(matterExpenses.id, expenseId), eq(matterExpenses.matterId, matterId)));
  if (!e) return;
  await db.update(matterExpenses).set({ reimbursedAt: e.reimbursedAt ? null : todayISO() }).where(eq(matterExpenses.id, expenseId));
  refresh(matterId);
}

export async function deleteExpenseAction(expenseId: number, matterId: number) {
  const user = await requirePermission("facturacion.ver");
  if (!(await getAccessibleMatter(user, matterId))) return;
  await db.delete(matterExpenses).where(and(eq(matterExpenses.id, expenseId), eq(matterExpenses.matterId, matterId)));
  refresh(matterId);
}
