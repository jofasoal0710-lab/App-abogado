"use server";

import { and, count, desc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { documents, feeServices, invoices, matterFeeStages, matterMembers, matterNotes, matters, users } from "@/db/schema";
import { replaceMatterStages } from "@/lib/tariff";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { canAccessNote, getAccessibleClient, getAccessibleMatter, getHolders } from "@/lib/access";
import { reassignLostAccessEvents } from "@/lib/access-effects";
import { logAccessChange } from "@/lib/access-log";
import { ACCESS_DENIED, CLIENT_ACCESS_DENIED, activeHolderIds, canManageMatterAccess, describeVisibility, minimumMatterVisibility } from "@/lib/access-rules";
import { requirePermission, requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";
import { formatNumber, nextSequence } from "@/lib/numbering";
import { deleteFile } from "@/lib/storage";
import { can } from "@/lib/permissions";

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
    serviceId: z.number().int().positive().nullable(),
    feeBaseCents: z.number().int().nonnegative().nullable(),
    suggestedFeeCents: z.number().int().nonnegative().nullable(),
    hourlyRateCents: z.number().int().nonnegative().max(2_000_000_000).nullable(),
    openedAt: isoDate,
    visibility: z.enum(["abierto", "restringido", "confidencial"]).optional(),
  })
  .refine((v) => v.billingType !== "tarifa_fija" || (v.fixedFeeCents ?? 0) > 0, {
    message: "Indica los honorarios del proceso (monto total)",
    path: ["fixedFeeCents"],
  });

function parseMatter(formData: FormData) {
  const feeRaw = str(formData, "fixedFee");
  const fee = feeRaw ? parseMoneyToCents(feeRaw) : null;
  if (feeRaw && fee === null) return { error: "Los honorarios pactados no son un importe válido" } as const;
  const billingType = str(formData, "billingType");
  const money = (name: string, label: string) => {
    const raw = str(formData, name);
    if (!raw) return { cents: null };
    const cents = parseMoneyToCents(raw);
    return cents === null || cents < 0 ? { error: `${label} no es un importe válido` } : { cents };
  };
  const base = money("feeBase", "La cuantía");
  if ("error" in base) return { error: base.error } as const;
  const rate = money("hourlyRate", "La tarifa por hora");
  if ("error" in rate) return { error: rate.error } as const;
  const suggested = money("suggestedFee", "El monto sugerido");

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
    serviceId: intOrNull(formData, "serviceId"),
    feeBaseCents: base.cents,
    suggestedFeeCents: "cents" in suggested ? suggested.cents : null,
    hourlyRateCents: billingType === "por_horas" ? rate.cents : null,
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

  // El cliente debe ser uno que puedas ver; si es confidencial, sus expedientes nunca son abiertos.
  const client = await getAccessibleClient(user, result.data.clientId);
  if (!client) return { error: CLIENT_ACCESS_DENIED };
  const service = await serviceFor(result.data.serviceId);
  if (service === false) return { error: "El servicio elegido ya no existe en el tarifario." };
  const visibility = minimumMatterVisibility(client, result.data.visibility ?? "abierto");
  if (visibility === "confidencial") {
    if (result.data.responsibleId === null) return { error: "Un expediente confidencial necesita un responsable." };
    const [resp] = await db.select({ active: users.active }).from(users).where(eq(users.id, result.data.responsibleId));
    if (!resp?.active) return { error: "El responsable de un expediente confidencial debe ser una persona activa." };
  }

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
      .values({ ...result.data, visibility, number })
      .returning({ id: matters.id });
    // Por proceso con un servicio que se cobra por etapas: se reparten los honorarios.
    if (result.data.billingType === "tarifa_fija" && service?.stages.length && result.data.fixedFeeCents) {
      await replaceMatterStages(tx, created.id, result.data.fixedFeeCents, service.stages);
    }
    // Quien crea un expediente restringido o confidencial sin ser su responsable no puede quedarse sin
    // acceso a lo que acaba de crear: se le añade como miembro. (Un administrador ya ve los restringidos,
    // pero no los confidenciales.)
    const creatorNeedsMembership =
      (visibility === "restringido" && !can(user, "expedientes.ver_restringidos")) || visibility === "confidencial";
    if (creatorNeedsMembership && result.data.responsibleId !== user.id) {
      await tx.insert(matterMembers).values({ matterId: created.id, userId: user.id, addedById: user.id });
    }
    if (visibility !== "abierto") {
      const why = visibility !== (result.data.visibility ?? "abierto") ? " (el cliente es confidencial)" : " (al crearlo)";
      await logAccessChange(created.id, user.id, "visibilidad", `Visibilidad: ${describeVisibility(visibility)}${why}`, tx);
    }
    return created;
  });
  revalidatePath("/expedientes");
  redirect(`/expedientes/${row.id}?tab=escritos&nuevo=1`);
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
  const service = await serviceFor(result.data.serviceId);
  if (service === false) return { error: "El servicio elegido ya no existe en el tarifario." };

  // Solo los administradores y el responsable actual pueden cambiar quién es el responsable.
  const canManage = canManageMatterAccess(user, current);
  const { visibility: _ignored, ...editable } = result.data; // la visibilidad solo se cambia en la pestaña Acceso
  const data = canManage ? editable : { ...editable, responsibleId: current.responsibleId };

  // Un expediente confidencial no puede quedarse sin responsable activo (nadie podría gestionarlo).
  if (current.visibility === "confidencial" && data.responsibleId !== current.responsibleId) {
    if (data.responsibleId === null) return { error: "Un expediente confidencial necesita un responsable." };
    const [next] = await db.select({ active: users.active }).from(users).where(eq(users.id, data.responsibleId));
    if (!next?.active) return { error: "El responsable de un expediente confidencial debe ser una persona activa." };
  }

  // Cambiar de cliente: solo a uno que puedas ver, y un cliente confidencial no admite expedientes abiertos.
  let visibility = current.visibility;
  if (data.clientId !== current.clientId) {
    const newClient = await getAccessibleClient(user, data.clientId);
    if (!newClient) return { error: CLIENT_ACCESS_DENIED };
    visibility = minimumMatterVisibility(newClient, current.visibility);
  }
  // Todo o nada: los datos, las anotaciones en el historial y la reasignación de eventos.
  await db.transaction(async (tx) => {
    await tx.update(matters).set({ ...data, visibility }).where(eq(matters.id, id));
    // Etapas de cobro: si ninguna está facturada, se rehacen según el servicio y el monto nuevos.
    const feeChanged = data.billingType !== current.billingType || data.fixedFeeCents !== current.fixedFeeCents || data.serviceId !== current.serviceId;
    if (feeChanged) {
      const stages = await tx.select({ invoiceId: matterFeeStages.invoiceId }).from(matterFeeStages).where(eq(matterFeeStages.matterId, id));
      if (!stages.some((st) => st.invoiceId !== null)) {
        const next = data.billingType === "tarifa_fija" && data.fixedFeeCents && service ? service.stages : [];
        if (next.length || stages.length) await replaceMatterStages(tx, id, data.fixedFeeCents ?? 0, next);
      }
    }
    if (visibility !== current.visibility) {
      await logAccessChange(id, user.id, "visibilidad", `Visibilidad: ${describeVisibility(visibility)} (el nuevo cliente es confidencial)`, tx);
    }
    if (canManage && data.responsibleId !== current.responsibleId) {
      const names = await tx.select({ id: users.id, name: users.name }).from(users);
      const nameOf = (uid: number | null) => names.find((n) => n.id === uid)?.name ?? "sin asignar";
      await logAccessChange(id, user.id, "responsable", `Responsable: ${nameOf(current.responsibleId)} → ${nameOf(data.responsibleId)}`, tx);
    }
    // El responsable anterior puede haber perdido el acceso, y con él sus eventos pendientes.
    await reassignLostAccessEvents(id, user.id, tx);
  });
  revalidatePath("/expedientes");
  // Si quien edita ya no ve el expediente (se quitó como responsable), no se le deja en un 404.
  if (!(await getAccessibleMatter(user, id))) redirect("/expedientes");
  redirect(`/expedientes/${id}`);
}

/** El servicio del tarifario (null si no se eligió; false si no existe). */
async function serviceFor(serviceId: number | null): Promise<{ id: number; stages: { name: string; percent: number }[] } | null | false> {
  if (!serviceId) return null;
  const [svc] = await db.select({ id: feeServices.id, stages: feeServices.stages }).from(feeServices).where(eq(feeServices.id, serviceId)).limit(1);
  return svc ?? false;
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
  // Solo el autor, o quien tenga «borrar notas de otras personas», puede borrar una nota.
  const condition =
    can(user, "notas.borrar_todas")
      ? eq(matterNotes.id, noteId)
      : and(eq(matterNotes.id, noteId), eq(matterNotes.authorId, user.id));
  await db.delete(matterNotes).where(condition);
  revalidatePath(`/expedientes/${matterId}`);
}

export async function deleteMatterAction(id: number) {
  const user = await requirePermission("expedientes.borrar");
  // Tener el permiso no basta: sin acceso (p. ej. un confidencial) tampoco se puede borrar.
  if (!(await getAccessibleMatter(user, id))) redirect("/expedientes");

  const [{ n }] = await db.select({ n: count() }).from(invoices).where(eq(invoices.matterId, id));
  if (n > 0) redirect(`/expedientes/${id}?error=has_invoices`);

  const docs = await db.select({ key: documents.storageKey }).from(documents).where(eq(documents.matterId, id));
  await db.delete(matters).where(eq(matters.id, id));
  await Promise.all(docs.map((d) => deleteFile(d.key)));

  revalidatePath("/expedientes");
  redirect("/expedientes");
}
