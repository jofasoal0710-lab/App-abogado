"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, documents, intakeFiles, intakeRequests, intakeSettings, matterMembers, matters, users } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { getAccessibleClient } from "@/lib/access";
import { logAccessChange, logClientAccessChange } from "@/lib/access-log";
import { CLIENT_ACCESS_DENIED, describeVisibility, minimumMatterVisibility, type MatterVisibility } from "@/lib/access-rules";
import { requirePermission } from "@/lib/auth";
import { parseClient } from "@/lib/client-parse";
import { stampSessionActor } from "@/lib/data-audit";
import { todayISO } from "@/lib/dates";
import { INTAKE_AREAS, type IntakeArea } from "@/lib/intake";
import { conflictSummaryText, findConflicts } from "@/lib/intake-db";
import { nextMatterNumber } from "@/lib/matter-number";
import { can } from "@/lib/permissions";
import { deleteFile } from "@/lib/storage";

const STILL_PENDING = "Esta solicitud ya no está pendiente (otra persona la ha resuelto).";

function refresh(id?: number) {
  revalidatePath("/solicitudes");
  if (id) revalidatePath(`/solicitudes/${id}`);
  revalidatePath("/", "layout");
}

export async function saveIntakeSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("solicitudes.gestionar");
  const enabled = formData.get("enabled") === "on";
  const intro = optStr(formData, "intro")?.slice(0, 2000) ?? null;
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx
      .insert(intakeSettings)
      .values({ id: 1, enabled, intro })
      .onConflictDoUpdate({ target: intakeSettings.id, set: { enabled, intro, updatedAt: new Date() } });
  });
  revalidatePath("/solicitudes");
  revalidatePath("/solicitud");
  return { ok: enabled ? "Formulario activado: ya se pueden enviar solicitudes." : "Formulario desactivado: el enlace público muestra «no disponible»." };
}

export async function discardIntakeAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("solicitudes.gestionar");
  const [req] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id));
  if (!req) return { error: "La solicitud no existe." };
  const hits = await findConflicts(user, req);
  const done = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    return tx
      .update(intakeRequests)
      .set({ status: "descartada", reviewedById: user.id, reviewedAt: new Date(), reviewNote: optStr(formData, "note")?.slice(0, 2000) ?? null, conflictSummary: conflictSummaryText(hits, user.name) })
      .where(and(eq(intakeRequests.id, id), eq(intakeRequests.status, "pendiente")))
      .returning({ id: intakeRequests.id });
  });
  if (!done.length) return { error: STILL_PENDING };
  refresh(id);
  return { ok: "Solicitud descartada. Se borrará sola dentro de 6 meses." };
}

export async function reopenIntakeAction(id: number) {
  await requirePermission("solicitudes.gestionar");
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx
      .update(intakeRequests)
      .set({ status: "pendiente", reviewedById: null, reviewedAt: null })
      .where(and(eq(intakeRequests.id, id), eq(intakeRequests.status, "descartada")));
  });
  refresh(id);
}

/** Borra la solicitud y sus adjuntos (p. ej. si la persona pide que se eliminen sus datos). Las aceptadas no: sus datos ya son del cliente. */
export async function deleteIntakeAction(id: number) {
  await requirePermission("solicitudes.gestionar");
  const files = await db.select({ k: intakeFiles.storageKey }).from(intakeFiles).where(eq(intakeFiles.requestId, id));
  const gone = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    return tx.delete(intakeRequests).where(and(eq(intakeRequests.id, id), eq(intakeRequests.status, "descartada"))).returning({ id: intakeRequests.id });
  });
  if (gone.length) for (const f of files) await deleteFile(f.k).catch(() => undefined);
  refresh();
  redirect("/solicitudes?estado=descartada");
}

/**
 * Acepta la solicitud: crea el cliente (o usa uno existente), abre el expediente, pasa los adjuntos a sus
 * documentos y deja constancia de la revisión de conflictos. Todo o nada.
 */
export async function acceptIntakeAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("solicitudes.gestionar");
  const [req] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id));
  if (!req) return { error: "La solicitud no existe." };
  if (req.status !== "pendiente") return { error: STILL_PENDING };

  const existingId = str(formData, "mode") === "existente" ? intOrNull(formData, "existingClientId") : null;
  if (str(formData, "mode") === "existente" && !existingId) return { error: "Elige el cliente existente." };
  let clientData: ReturnType<typeof parseClient> | null = null;
  let existing: Awaited<ReturnType<typeof getAccessibleClient>> = null;
  if (existingId) {
    existing = await getAccessibleClient(user, existingId);
    if (!existing) return { error: CLIENT_ACCESS_DENIED };
  } else {
    clientData = parseClient(formData);
    if (!clientData.success) return { error: firstZodError(clientData.error) };
  }

  const title = str(formData, "title");
  if (title.length < 3 || title.length > 250) return { error: "El título del expediente es obligatorio (mínimo 3 caracteres)." };
  const area = (INTAKE_AREAS as readonly string[]).includes(str(formData, "area")) ? (str(formData, "area") as IntakeArea) : req.area;
  const responsibleId = intOrNull(formData, "responsibleId");
  if (responsibleId) {
    const [r] = await db.select({ active: users.active }).from(users).where(eq(users.id, responsibleId));
    if (!r?.active) return { error: "El responsable debe ser una persona activa del equipo." };
  }
  const clientConfidential = !existing && str(formData, "clientVisibility") === "confidencial" && can(user, "clientes.gestionar");
  const requested = (["abierto", "restringido", "confidencial"] as const).find((v) => v === str(formData, "visibility")) ?? "abierto";
  const visibility: MatterVisibility = minimumMatterVisibility({ visibility: existing ? existing.visibility : clientConfidential ? "confidencial" : "abierto" }, requested);
  if (visibility === "confidencial" && !responsibleId) return { error: "Un expediente confidencial necesita un responsable." };

  const hits = await findConflicts(user, req);
  const ack = formData.get("conflictsReviewed") === "on";
  if (hits.length && !ack) return { error: "Hay coincidencias en la revisión de conflictos: revísalas y marca la casilla de que las has comprobado." };

  const result = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    // Bloquea la solicitud: dos personas no pueden aceptarla a la vez.
    const [locked] = await tx.select({ status: intakeRequests.status }).from(intakeRequests).where(eq(intakeRequests.id, id)).for("update");
    if (locked?.status !== "pendiente") return null;

    let clientId = existing?.id;
    if (!clientId && clientData?.success) {
      const [c] = await tx
        .insert(clients)
        .values({ ...clientData.data, visibility: clientConfidential ? "confidencial" : "abierto", createdById: user.id })
        .returning({ id: clients.id });
      clientId = c.id;
      if (clientConfidential) await logClientAccessChange(c.id, user.id, "Cliente creado como confidencial (desde una solicitud)", tx);
    }
    const number = await nextMatterNumber(tx);
    const [m] = await tx
      .insert(matters)
      .values({
        number,
        title,
        clientId: clientId!,
        area,
        visibility,
        responsibleId,
        opposingParty: optStr(formData, "opposingParty")?.slice(0, 250) ?? null,
        description: `Consulta recibida por el formulario público el ${req.createdAt.toLocaleDateString("es-CR")}:\n\n${req.summary}${req.deadline ? `\n\nFecha límite indicada: ${req.deadline}` : ""}`.slice(0, 10000),
        openedAt: todayISO(),
      })
      .returning({ id: matters.id });
    const creatorNeedsMembership = (visibility === "restringido" && !can(user, "expedientes.ver_restringidos")) || visibility === "confidencial";
    if (creatorNeedsMembership && responsibleId !== user.id) await tx.insert(matterMembers).values({ matterId: m.id, userId: user.id, addedById: user.id });
    if (visibility !== "abierto") await logAccessChange(m.id, user.id, "visibilidad", `Visibilidad: ${describeVisibility(visibility)} (al crearlo desde una solicitud)`, tx);

    // Los adjuntos pasan a ser documentos del expediente (mismo fichero, sin copiarlo).
    const files = await tx.select().from(intakeFiles).where(eq(intakeFiles.requestId, id));
    if (files.length) {
      await tx.insert(documents).values(files.map((f) => ({ matterId: m.id, name: f.name, category: "Aportado por el cliente", mimeType: f.mimeType, sizeBytes: f.sizeBytes, storageKey: f.storageKey, uploadedById: user.id })));
      await tx.delete(intakeFiles).where(eq(intakeFiles.requestId, id));
    }
    await tx
      .update(intakeRequests)
      .set({ status: "aceptada", reviewedById: user.id, reviewedAt: new Date(), clientId, matterId: m.id, reviewNote: optStr(formData, "note")?.slice(0, 2000) ?? null, conflictSummary: conflictSummaryText(hits, user.name) })
      .where(eq(intakeRequests.id, id));
    return m.id;
  });
  if (!result) return { error: STILL_PENDING };
  refresh(id);
  revalidatePath("/clientes");
  revalidatePath("/expedientes");
  redirect(`/expedientes/${result}?nuevo=1`);
}
