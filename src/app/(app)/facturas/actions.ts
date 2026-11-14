"use server";

import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invoiceItems, invoices, matters, payments, timeEntries } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { canManageInvoices, requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { addDaysISO, todayISO } from "@/lib/dates";
import { invoiceTotals, parseDurationToMinutes, parseMoneyToCents, parseQuantityToHundredths } from "@/lib/money";
import { BusinessError } from "@/lib/invoice-errors";
import { formatNumber, nextSequence } from "@/lib/numbering";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida");
const headerSchema = z
  .object({
    issueDate: isoDate,
    dueDate: isoDate.nullable(),
    taxRate: z.number().int("El IVA debe ser un número entero").min(0).max(100, "El IVA debe estar entre 0 y 100"),
    notes: z.string().max(3000).nullable(),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.issueDate, {
    message: "El vencimiento no puede ser anterior a la fecha de factura",
    path: ["dueDate"],
  });

function parseHeader(formData: FormData) {
  const taxRaw = str(formData, "taxRate");
  return headerSchema.safeParse({
    issueDate: str(formData, "issueDate") || todayISO(),
    dueDate: optStr(formData, "dueDate"),
    taxRate: taxRaw === "" ? config.defaultTaxRate : Number(taxRaw),
    notes: optStr(formData, "notes"),
  });
}

function refresh(id?: number) {
  revalidatePath("/facturas");
  revalidatePath("/");
  if (id) revalidatePath(`/facturas/${id}`);
}

/* ---------- Crear factura (borrador) ---------- */

export async function createInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const clientId = intOrNull(formData, "clientId");
  const matterId = intOrNull(formData, "matterId");
  if (!clientId) return { error: "Selecciona un cliente." };
  const header = parseHeader(formData);
  if (!header.success) return { error: firstZodError(header.error) };

  const entryIds = formData.getAll("entry").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const feeRaw = str(formData, "fixedFee");
  const includeFee = formData.get("includeFixedFee") === "on";
  const feeCents = includeFee ? parseMoneyToCents(feeRaw) : null;
  if (includeFee && (feeCents === null || feeCents <= 0)) return { error: "El importe de los honorarios fijos no es válido." };

  let invoiceId: number;
  try {
    invoiceId = await db.transaction(async (tx) => {
      let matterTitle = "";
      if (matterId) {
        const [m] = await tx.select().from(matters).where(eq(matters.id, matterId)).limit(1);
        if (!m) throw new BusinessError("matter_missing");
        if (m.clientId !== clientId) throw new BusinessError("matter_client_mismatch");
        matterTitle = m.title;
      } else if (entryIds.length || includeFee) {
        throw new BusinessError("matter_required");
      }

      const [inv] = await tx.insert(invoices).values({ clientId, matterId, ...header.data }).returning({ id: invoices.id });

      if (entryIds.length) {
        // Bloquea las entradas elegidas: dos facturas simultáneas no pueden facturar las mismas horas.
        const entries = await tx
          .select({
            id: timeEntries.id,
            workedOn: timeEntries.workedOn,
            minutes: timeEntries.minutes,
            rateCents: timeEntries.rateCents,
            description: timeEntries.description,
          })
          .from(timeEntries)
          .where(
            and(
              inArray(timeEntries.id, entryIds),
              eq(timeEntries.matterId, matterId!),
              eq(timeEntries.billable, true),
              isNull(timeEntries.invoiceId),
            ),
          )
          .for("update");
        if (entries.length !== new Set(entryIds).size) {
          throw new BusinessError("already_billed");
        }
        await tx.insert(invoiceItems).values(
          entries
            .sort((a, b) => a.workedOn.localeCompare(b.workedOn) || a.id - b.id)
            .map((e) => ({
              invoiceId: inv.id,
              description: `${e.workedOn.split("-").reverse().join("/")} · ${e.description}`,
              unit: "horas" as const,
              quantity: e.minutes,
              unitPriceCents: e.rateCents,
              timeEntryId: e.id,
            })),
        );
        await tx.update(timeEntries).set({ invoiceId: inv.id }).where(inArray(timeEntries.id, entries.map((e) => e.id)));
      }

      if (includeFee && feeCents) {
        await tx.insert(invoiceItems).values({
          invoiceId: inv.id,
          description: `Honorarios profesionales: ${matterTitle}`,
          unit: "unidades",
          quantity: 100,
          unitPriceCents: feeCents,
        });
      }
      return inv.id;
    });
  } catch (err) {
    if (err instanceof BusinessError) return { error: err.message };
    throw err;
  }

  refresh();
  redirect(`/facturas/${invoiceId}`);
}

/* ---------- Edición del borrador ---------- */

async function requireDraft(id: number) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) redirect("/facturas");
  if (inv.status !== "borrador") redirect(`/facturas/${id}?error=not_draft`);
  return inv;
}

export async function updateInvoiceHeaderAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  await requireDraft(id);
  const header = parseHeader(formData);
  if (!header.success) return { error: firstZodError(header.error) };
  await db.update(invoices).set(header.data).where(eq(invoices.id, id));
  refresh(id);
  return { ok: "Datos de la factura guardados." };
}

const itemSchema = z.object({
  description: z.string().min(2, "Describe el concepto").max(1000),
  unit: z.enum(["horas", "unidades"]),
  quantity: z.number({ error: "La cantidad no es válida" }).int().positive("La cantidad debe ser mayor que cero"),
  unitPriceCents: z.number({ error: "El precio no es válido" }).int().nonnegative(),
});

export async function addItemAction(invoiceId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  await requireDraft(invoiceId);

  const unit = str(formData, "unit") === "horas" ? "horas" : "unidades";
  const quantity =
    unit === "horas" ? parseDurationToMinutes(str(formData, "quantity")) : parseQuantityToHundredths(str(formData, "quantity"));
  const price = parseMoneyToCents(str(formData, "unitPrice"));
  const parsed = itemSchema.safeParse({
    description: str(formData, "description"),
    unit,
    quantity: quantity ?? undefined,
    unitPriceCents: price ?? undefined,
  });
  if (!parsed.success) {
    return {
      error:
        quantity === null
          ? unit === "horas"
            ? "Duración no válida (usa 1:30, 90m, 1,5…)."
            : "Cantidad no válida (usa números como 1 o 2,5)."
          : firstZodError(parsed.error),
    };
  }

  await db.insert(invoiceItems).values({ invoiceId, ...parsed.data });
  refresh(invoiceId);
  return { ok: "Línea añadida." };
}

export async function deleteItemAction(invoiceId: number, itemId: number) {
  await requireUser();
  await requireDraft(invoiceId);
  await db.transaction(async (tx) => {
    const [item] = await tx
      .delete(invoiceItems)
      .where(and(eq(invoiceItems.id, itemId), eq(invoiceItems.invoiceId, invoiceId)))
      .returning({ timeEntryId: invoiceItems.timeEntryId });
    // Libera las horas para poder facturarlas en otra factura.
    if (item?.timeEntryId) {
      await tx.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.id, item.timeEntryId));
    }
  });
  refresh(invoiceId);
}

export async function deleteDraftAction(id: number) {
  await requireUser();
  await requireDraft(id);
  await db.delete(invoices).where(eq(invoices.id, id)); // time_entries.invoice_id → NULL por la FK
  refresh();
  redirect("/facturas");
}

/* ---------- Emisión, cobros y anulación ---------- */

export async function emitInvoiceAction(id: number) {
  const user = await requireUser();
  if (!canManageInvoices(user)) redirect(`/facturas/${id}?error=forbidden`);

  let error: string | null = null;
  try {
    await db.transaction(async (tx) => {
      // Numeración correlativa sin huecos ni duplicados.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invoice_number'))`);
      const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
      if (!inv || inv.status !== "borrador") throw new BusinessError("not_draft");
      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      if (items.length === 0) throw new BusinessError("no_items");
      if (invoiceTotals(items, inv.taxRate).totalCents <= 0) throw new BusinessError("zero_total");

      const today = todayISO();
      const year = Number(today.slice(0, 4));
      const prefix = "FAC";
      const [last] = await tx
        .select({ number: invoices.number })
        .from(invoices)
        .where(like(invoices.number, `${prefix}-${year}-%`))
        .orderBy(desc(invoices.number))
        .limit(1);
      const number = formatNumber(prefix, year, nextSequence(last?.number, prefix, year));
      const dueDate = inv.dueDate && inv.dueDate >= today ? inv.dueDate : addDaysISO(today, 30);
      await tx.update(invoices).set({ number, status: "emitida", issueDate: today, dueDate }).where(eq(invoices.id, id));
    });
  } catch (err) {
    if (!(err instanceof BusinessError)) throw err;
    error = err.code;
  }
  refresh(id);
  redirect(error ? `/facturas/${id}?error=${error}` : `/facturas/${id}`);
}

const paymentSchema = z.object({
  amountCents: z.number({ error: "El importe no es válido" }).int().positive("El importe debe ser mayor que cero"),
  paidAt: isoDate,
  method: z.enum(["transferencia", "tarjeta", "efectivo", "cheque", "otro"]),
  reference: z.string().max(200).nullable(),
});

export async function registerPaymentAction(
  invoiceId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const amount = parseMoneyToCents(str(formData, "amount"));
  const parsed = paymentSchema.safeParse({
    amountCents: amount ?? undefined,
    paidAt: str(formData, "paidAt") || todayISO(),
    method: str(formData, "method") || "transferencia",
    reference: optStr(formData, "reference"),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  try {
    await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
      if (!inv || inv.status !== "emitida") throw new BusinessError("not_emitted_pay");
      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const prior = await tx.select({ amountCents: payments.amountCents }).from(payments).where(eq(payments.invoiceId, invoiceId));
      const total = invoiceTotals(items, inv.taxRate).totalCents;
      const paid = prior.reduce((s, p) => s + p.amountCents, 0);
      const outstanding = total - paid;
      if (parsed.data.amountCents > outstanding) {
        throw new BusinessError("overpay");
      }
      await tx.insert(payments).values({ invoiceId, ...parsed.data });
      if (parsed.data.amountCents === outstanding) {
        await tx.update(invoices).set({ status: "pagada" }).where(eq(invoices.id, invoiceId));
      }
    });
  } catch (err) {
    if (err instanceof BusinessError) return { error: err.message };
    throw err;
  }
  refresh(invoiceId);
  return { ok: "Cobro registrado." };
}

export async function deletePaymentAction(invoiceId: number, paymentId: number) {
  const user = await requireUser();
  if (!canManageInvoices(user)) redirect(`/facturas/${invoiceId}?error=forbidden`);
  await db.transaction(async (tx) => {
    await tx.delete(payments).where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)));
    await tx.update(invoices).set({ status: "emitida" }).where(and(eq(invoices.id, invoiceId), eq(invoices.status, "pagada")));
  });
  refresh(invoiceId);
}

export async function voidInvoiceAction(id: number) {
  const user = await requireUser();
  if (!canManageInvoices(user)) redirect(`/facturas/${id}?error=forbidden`);

  let error: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
      if (!inv || inv.status !== "emitida") throw new BusinessError("not_emitted_void");
      const [hasPayments] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.invoiceId, id)).limit(1);
      if (hasPayments) throw new BusinessError("has_payments");
      // El número se conserva (la numeración fiscal no se reutiliza) y las horas quedan libres.
      await tx.update(invoices).set({ status: "anulada" }).where(eq(invoices.id, id));
      await tx.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.invoiceId, id));
    });
  } catch (err) {
    if (!(err instanceof BusinessError)) throw err;
    error = err.code;
  }
  refresh(id);
  redirect(error ? `/facturas/${id}?error=${error}` : `/facturas/${id}`);
}
