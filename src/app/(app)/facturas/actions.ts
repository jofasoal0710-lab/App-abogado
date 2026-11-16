"use server";

import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { invoiceItems, invoices, matters, payments, timeEntries } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { canAccessInvoice, getAccessibleClient, getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED, CLIENT_ACCESS_DENIED } from "@/lib/access-rules";
import { canManageInvoices, requireUser, type CurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { addDaysISO, todayISO } from "@/lib/dates";
import { invoiceTotals, parseDurationToMinutes, parseMoneyToCents, parseQuantityToHundredths } from "@/lib/money";
import { BusinessError } from "@/lib/invoice-errors";
import { loadAdjustments, netTotal, reconcileStatus } from "@/lib/invoice-queries";
import { INVOICE_PREFIX, RECTIFICATION_PREFIX, canRectify, exceedsOriginal, negateItems } from "@/lib/rectification";
import { formatNumber, nextSequence } from "@/lib/numbering";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida");
const headerSchema = z
  .object({
    issueDate: isoDate,
    dueDate: isoDate.nullable(),
    taxRate: z.number().int("El IVA debe ser un número entero").min(0).max(100, "El IVA debe estar entre 0 y 100"),
    withholdingRate: z.number({ error: "La retención no es válida" }).int("La retención debe ser un número entero").min(0).max(60, "La retención debe estar entre 0 y 60"),
    notes: z.string().max(3000).nullable(),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.issueDate, {
    message: "El vencimiento no puede ser anterior a la fecha de factura",
    path: ["dueDate"],
  });

/** `defaultWithholding`: retención si el campo viene vacío (en el alta, según el tipo de cliente). */
function parseHeader(formData: FormData, defaultWithholding = 0) {
  const taxRaw = str(formData, "taxRate");
  const whRaw = str(formData, "withholdingRate");
  return headerSchema.safeParse({
    issueDate: str(formData, "issueDate") || todayISO(),
    dueDate: optStr(formData, "dueDate"),
    taxRate: taxRaw === "" ? config.defaultTaxRate : Number(taxRaw),
    withholdingRate: whRaw === "" ? defaultWithholding : Number(whRaw),
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
  const user = await requireUser();

  const clientId = intOrNull(formData, "clientId");
  const matterId = intOrNull(formData, "matterId");
  if (!clientId) return { error: "Selecciona un cliente." };
  const invoiceClient = await getAccessibleClient(user, clientId);
  if (!invoiceClient) return { error: CLIENT_ACCESS_DENIED };
  if (matterId && !(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  // La retención de IRPF solo se propone a empresas (a un particular no se le practica); se puede cambiar.
  const header = parseHeader(formData, invoiceClient.type === "empresa" ? config.defaultWithholdingRate : 0);
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

async function requireDraft(id: number, user: CurrentUser) {
  // Sin acceso al expediente de la factura se comporta como si no existiera.
  if (!(await canAccessInvoice(user, id))) redirect("/facturas");
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
  const user = await requireUser();
  await requireDraft(id, user);
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
  // El signo se valida según el tipo de factura: solo las rectificativas admiten importes negativos.
  unitPriceCents: z.number({ error: "El precio no es válido" }).int(),
});

export async function addItemAction(invoiceId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const draft = await requireDraft(invoiceId, user);

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

  if (draft.kind === "factura" && parsed.data.unitPriceCents < 0) {
    return { error: "El precio no puede ser negativo: solo las facturas rectificativas admiten importes negativos." };
  }
  if (draft.kind === "rectificativa" && parsed.data.unitPriceCents === 0) return { error: "El precio no puede ser cero." };

  await db.insert(invoiceItems).values({ invoiceId, ...parsed.data });
  refresh(invoiceId);
  return { ok: "Línea añadida." };
}

export async function deleteItemAction(invoiceId: number, itemId: number) {
  const user = await requireUser();
  await requireDraft(invoiceId, user);
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
  const user = await requireUser();
  await requireDraft(id, user);
  await db.delete(invoices).where(eq(invoices.id, id)); // time_entries.invoice_id → NULL por la FK
  refresh();
  redirect("/facturas");
}

/* ---------- Emisión, cobros y anulación ---------- */

export async function emitInvoiceAction(id: number) {
  const user = await requireUser();
  if (!(await canAccessInvoice(user, id))) redirect("/facturas");
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
      const totals = invoiceTotals(items, inv.taxRate, inv.withholdingRate);
      const isRectification = inv.kind === "rectificativa";

      if (!isRectification) {
        if (totals.totalCents <= 0) throw new BusinessError("zero_total");
      } else {
        // Una rectificativa puede ser negativa (abono) o positiva (la original se quedó corta), pero no cero.
        if (totals.subtotalCents === 0) throw new BusinessError("zero_total");
        const [original] = inv.rectifiesInvoiceId
          ? await tx.select().from(invoices).where(eq(invoices.id, inv.rectifiesInvoiceId)).for("update")
          : [];
        if (!original || !canRectify(original)) throw new BusinessError("not_rectifiable");
        const origItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, original.id));
        const origTotal = invoiceTotals(origItems, original.taxRate, original.withholdingRate).totalCents;
        const others = await loadAdjustments(tx, [original.id]);
        if (exceedsOriginal(origTotal, [others.get(original.id)?.cents ?? 0], totals.totalCents)) throw new BusinessError("rectify_exceeds");
      }

      const today = todayISO();
      const year = Number(today.slice(0, 4));
      // Las rectificativas llevan una serie propia (RECT), como exige la normativa.
      const prefix = isRectification ? RECTIFICATION_PREFIX : INVOICE_PREFIX;
      const [last] = await tx
        .select({ number: invoices.number })
        .from(invoices)
        .where(like(invoices.number, `${prefix}-${year}-%`))
        .orderBy(desc(invoices.number))
        .limit(1);
      const number = formatNumber(prefix, year, nextSequence(last?.number, prefix, year));
      const dueDate = isRectification ? null : inv.dueDate && inv.dueDate >= today ? inv.dueDate : addDaysISO(today, 30);
      await tx.update(invoices).set({ number, status: "emitida", issueDate: today, dueDate }).where(eq(invoices.id, id));

      if (isRectification && inv.rectifiesInvoiceId) {
        const originalId = inv.rectifiesInvoiceId;
        // Solo si la original queda del todo anulada (neto 0) se liberan sus horas para volver a facturarlas.
        if (inv.releaseHours && (await netTotal(tx, originalId)) === 0) {
          await tx.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.invoiceId, originalId));
        }
        await reconcileStatus(tx, originalId);
      }
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
  const user = await requireUser();
  if (!(await canAccessInvoice(user, invoiceId))) return { error: ACCESS_DENIED };
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
      if (inv.kind === "rectificativa") throw new BusinessError("rectification_payment");
      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const prior = await tx.select({ amountCents: payments.amountCents }).from(payments).where(eq(payments.invoiceId, invoiceId));
      // El saldo es el del NETO: lo facturado ± lo que corrigen sus rectificativas emitidas.
      const adjustment = (await loadAdjustments(tx, [invoiceId])).get(invoiceId)?.cents ?? 0;
      const total = invoiceTotals(items, inv.taxRate, inv.withholdingRate).totalCents + adjustment;
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
  if (!(await canAccessInvoice(user, invoiceId))) redirect("/facturas");
  if (!canManageInvoices(user)) redirect(`/facturas/${invoiceId}?error=forbidden`);
  await db.transaction(async (tx) => {
    await tx.delete(payments).where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)));
    await reconcileStatus(tx, invoiceId);
  });
  refresh(invoiceId);
}

/* ---------- Facturas rectificativas ---------- */

/**
 * Crea un BORRADOR de factura rectificativa de una factura emitida. La original no se modifica nunca
 * (método «por diferencias»): la rectificativa lleva su propia serie y número, refiere a la original e
 * indica el motivo. Con «total» las líneas son las de la original con el signo cambiado (un abono).
 */
export async function createRectificationAction(invoiceId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!canManageInvoices(user)) return { error: "No tienes permiso para realizar esta acción." };
  if (!(await canAccessInvoice(user, invoiceId))) return { error: ACCESS_DENIED };

  const reason = str(formData, "reason");
  if (reason.length < 5) return { error: "Indica el motivo de la rectificación (mínimo 5 caracteres): es obligatorio en la factura rectificativa." };
  if (reason.length > 500) return { error: "El motivo es demasiado largo (máximo 500 caracteres)." };
  const total = str(formData, "mode") !== "parcial";
  const releaseHours = total && formData.get("releaseHours") === "on";

  let newId: number;
  try {
    newId = await db.transaction(async (tx) => {
      const [original] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
      if (!original || !canRectify(original)) throw new BusinessError("not_rectifiable");

      const [rect] = await tx
        .insert(invoices)
        .values({
          clientId: original.clientId,
          matterId: original.matterId,
          kind: "rectificativa",
          rectifiesInvoiceId: original.id,
          rectificationReason: reason,
          taxRate: original.taxRate,
          withholdingRate: original.withholdingRate,
          releaseHours,
          issueDate: todayISO(),
          dueDate: null,
        })
        .returning({ id: invoices.id });

      if (total) {
        const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, original.id));
        if (items.length) {
          await tx.insert(invoiceItems).values(
            negateItems(items).map((it) => ({
              invoiceId: rect.id,
              description: it.description,
              unit: it.unit,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              // Sin vínculo con las horas: borrar una línea del abono no debe liberar horas de la original.
              timeEntryId: null,
            })),
          );
        }
      }
      return rect.id;
    });
  } catch (err) {
    if (err instanceof BusinessError) return { error: err.message };
    throw err;
  }

  refresh(invoiceId);
  redirect(`/facturas/${newId}`);
}
