"use server";

import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { documents, invoices, matterMembers, matterNotes, matters, users } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { canAccessNote, getAccessibleMatter } from "@/lib/access";
import { logAccessChange } from "@/lib/access-log";
import { ACCESS_DENIED, canManageMatterAccess, describeVisibility } from "@/lib/access-rules";
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
    visibility: z.enum(["abierto", "restringido"]).optional(),
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
    visibility: str(formData, "visibility") || undefined,
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) } as const;
  return { data: parsed.data } as const;
}

export async function createMatterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
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
      .values({ ...result.data, visibility: result.data.visibility ?? "abierto", number })
      .returning({ id: matters.id });
    // Quien crea un expediente restringido sin ser su responsable (ni administrador) no puede
    // quedarse sin acceso a lo que acaba de crear: se le añade como miembro.
    if (result.data.visibility === "restringido") {
      if (user.role !== "admin" && result.data.responsibleId !== user.id) {
        await tx.insert(matterMembers).values({ matterId: created.id, userId: user.id, addedById: user.id });
      }
    }
    return created;
  });

  if (result.data.visibility === "restringido") {
    await logAccessChange(row.id, user.id, "visibilidad", `Visibilidad: ${describeVisibility("restringido")} (al crearlo)`);
  }
  revalidatePath("/expedientes");
  redirect(`/expedientes/${row.id}`);
}

export async function updateMatterAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const current = await getAccessibleMatter(user, id);
  if (!current) return { error: ACCESS_DENIED };
  const result = parseMatter(formData);
  if ("error" in result) return { error: result.error };

  // Solo los administradores y el responsable actual pueden cambiar quién es el responsable.
  const canManage = canManageMatterAccess(user, current);
  const { visibility: _ignored, ...editable } = result.data; // la visibilidad solo se cambia en la pestaña Acceso
  const data = canManage ? editable : { ...editable, responsibleId: current.responsibleId };
  await db.update(matters).set(data).where(eq(matters.id, id));
  if (canManage && data.responsibleId !== current.responsibleId) {
    const names = await db.select({ id: users.id, name: users.name }).from(users);
    const nameOf = (uid: number | null) => names.find((n) => n.id === uid)?.name ?? "sin asignar";
    await logAccessChange(id, user.id, "responsable", `Responsable: ${nameOf(current.responsibleId)} → ${nameOf(data.responsibleId)}`);
  }
  revalidatePath("/expedientes");
  redirect(`/expedientes/${id}`);
}

const statusSchema = z.enum(["abierto", "en_curso", "en_espera", "cerrado", "archivado"]);

export async function changeStatusAction(id: number, formData: FormData) {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, id))) redirect("/expedientes");
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
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const body = str(formData, "body");
  if (body.length < 2) return { error: "Escribe el contenido de la nota." };
  if (body.length > 10000) return { error: "La nota es demasiado larga (máximo 10.000 caracteres)." };

  await db.insert(matterNotes).values({ matterId, authorId: user.id, body });
  revalidatePath(`/expedientes/${matterId}`);
  return { ok: "Nota añadida." };
}

export async function deleteNoteAction(noteId: number, matterId: number) {
  const user = await requireUser();
  if (!(await canAccessNote(user, noteId))) return;
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
