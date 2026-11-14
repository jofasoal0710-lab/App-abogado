"use server";

import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { documents, invoices, matterNotes, matters } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { requireAdmin, requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { formatNumber, nextSequence } from "@/lib/numbering";
import { deleteFile } from "@/lib/storage";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida");

const matterSchema = z
  .object({
    title: z.string().min(3, "El título es obligatorio (mínimo 3 caracteres)").max(250),
    clientId: z.number({ error: "Selecciona un cliente" }).int().positive("Selecciona un cliente"),
    area: z.enum(["civil", "penal", "laboral", "mercantil", "familia", "administrativo", "fiscal", "inmobiliario", "otros"]),
    responsibleId: z.number().int().positive().nullable(),
    court: z.string().max(250).nullable(),
    courtCaseNumber: z.string().max(100).nullable(),
    opposingParty: z.string().max(250).nullable(),
    description: z.string().max(10000).nullable(),
    billingType: z.enum(["por_horas", "tarifa_fija"]),
    fixedFeeCents: z.number().int().nonnegative().nullable(),
    openedAt: isoDate,
  })
  .refine((v) => v.billingType !== "tarifa_fija" || (v.fixedFeeCents ?? 0) > 0, {
    message: "Indica los honorarios pactados para la tarifa fija",
    path: ["fixedFeeCents"],
  });

function parseMatter(formData: FormData) {
  const feeRaw = str(formData, "fixedFee");
  const fee = feeRaw ? parseMoneyToCents(feeRaw) : null;
  if (feeRaw && fee === null) return { error: "Los honorarios pactados no son un importe válido" } as const;
  const billingType = str(formData, "billingType");

  const parsed = matterSchema.safeParse({
    title: str(formData, "title"),
    clientId: intOrNull(formData, "clientId") ?? undefined,
    area: str(formData, "area"),
    responsibleId: intOrNull(formData, "responsibleId"),
    court: optStr(formData, "court"),
    courtCaseNumber: optStr(formData, "courtCaseNumber"),
    opposingParty: optStr(formData, "opposingParty"),
    description: optStr(formData, "description"),
    billingType,
    fixedFeeCents: billingType === "tarifa_fija" ? fee : null,
    openedAt: str(formData, "openedAt") || todayISO(),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) } as const;
  return { data: parsed.data } as const;
}

export async function createMatterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const result = parseMatter(formData);
  if ("error" in result) return { error: result.error };

  const year = new Date().getFullYear();
  const prefix = "EXP";
  const row = await db.transaction(async (tx) => {
    // Bloqueo por transacción: dos altas simultáneas no pueden obtener el mismo número.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('matter_number'))`);
    const [last] = await tx
      .select({ number: matters.number })
      .from(matters)
      .where(like(matters.number, `${prefix}-${year}-%`))
      .orderBy(desc(matters.number))
      .limit(1);
    const number = formatNumber(prefix, year, nextSequence(last?.number, prefix, year));
    const [created] = await tx
      .insert(matters)
      .values({ ...result.data, number })
      .returning({ id: matters.id });
    return created;
  });

  revalidatePath("/expedientes");
  redirect(`/expedientes/${row.id}`);
}

export async function updateMatterAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const result = parseMatter(formData);
  if ("error" in result) return { error: result.error };

  await db.update(matters).set(result.data).where(eq(matters.id, id));
  revalidatePath("/expedientes");
  redirect(`/expedientes/${id}`);
}

const statusSchema = z.enum(["abierto", "en_curso", "en_espera", "cerrado", "archivado"]);

export async function changeStatusAction(id: number, formData: FormData) {
  await requireUser();
  const status = statusSchema.safeParse(str(formData, "status"));
  if (!status.success) redirect(`/expedientes/${id}`);

  const closing = status.data === "cerrado" || status.data === "archivado";
  await db
    .update(matters)
    .set({ status: status.data, closedAt: closing ? todayISO() : null })
    .where(eq(matters.id, id));
  revalidatePath("/expedientes");
  revalidatePath(`/expedientes/${id}`);
  redirect(`/expedientes/${id}`);
}

export async function addNoteAction(
  matterId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const body = str(formData, "body");
  if (body.length < 2) return { error: "Escribe el contenido de la nota." };
  if (body.length > 10000) return { error: "La nota es demasiado larga (máximo 10.000 caracteres)." };

  await db.insert(matterNotes).values({ matterId, authorId: user.id, body });
  revalidatePath(`/expedientes/${matterId}`);
  return { ok: "Nota añadida." };
}

export async function deleteNoteAction(noteId: number, matterId: number) {
  const user = await requireUser();
  // Solo el autor o un administrador pueden borrar una nota.
  const condition =
    user.role === "admin"
      ? eq(matterNotes.id, noteId)
      : and(eq(matterNotes.id, noteId), eq(matterNotes.authorId, user.id));
  await db.delete(matterNotes).where(condition);
  revalidatePath(`/expedientes/${matterId}`);
}

export async function deleteMatterAction(id: number) {
  await requireAdmin();

  const [{ n }] = await db.select({ n: count() }).from(invoices).where(eq(invoices.matterId, id));
  if (n > 0) redirect(`/expedientes/${id}?error=has_invoices`);

  const docs = await db.select({ key: documents.storageKey }).from(documents).where(eq(documents.matterId, id));
  await db.delete(matters).where(eq(matters.id, id));
  await Promise.all(docs.map((d) => deleteFile(d.key)));

  revalidatePath("/expedientes");
  redirect("/expedientes");
}
