"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { stampSessionActor } from "@/lib/data-audit";
import { db } from "@/db";
import { clients, matterMembers, matters, users } from "@/db/schema";
import { intOrNull, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter, getHolders, listOrphanConfidentialMatters } from "@/lib/access";
import { reassignLostAccessEvents } from "@/lib/access-effects";
import { logAccessChange } from "@/lib/access-log";
import { ACCESS_DENIED, activeHolderIds, canManageMatterAccess, describeVisibility } from "@/lib/access-rules";
import { requirePermission, requireUser } from "@/lib/auth";

/** Solo administradores (con acceso) y el responsable pueden gestionar el acceso. Devuelve el expediente o un error. */
async function loadManageable(matterId: number) {
  const user = await requireUser();
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter) return { error: ACCESS_DENIED } as const;
  if (!canManageMatterAccess(user, matter)) {
    return { error: "Solo los administradores y el responsable del expediente pueden gestionar el acceso." } as const;
  }
  return { user, matter } as const;
}

function refresh(matterId: number) {
  revalidatePath(`/expedientes/${matterId}`);
  revalidatePath("/expedientes");
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function setVisibilityAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return { error: ctx.error };
  const visibility = z.enum(["abierto", "restringido", "confidencial"]).safeParse(str(formData, "visibility"));
  if (!visibility.success) return { error: "Visibilidad no válida." };
  const target = visibility.data;
  if (target === ctx.matter.visibility) return { ok: "Sin cambios." };

  const [client] = await db.select({ visibility: clients.visibility }).from(clients).where(eq(clients.id, ctx.matter.clientId));
  if (target === "abierto" && client?.visibility === "confidencial") {
    return { error: "El cliente es confidencial: sus expedientes no pueden ser abiertos." };
  }

  if (target === "confidencial") {
    const { responsible, members } = await getHolders(matterId);
    if (!responsible?.active) {
      return { error: "Un expediente confidencial necesita un responsable activo. Asígnalo antes en «Editar»." };
    }
    // Si quien lo hace no conservara el acceso, se bloquearía a sí mismo: se exige ser responsable o miembro.
    const keeps = ctx.matter.responsibleId === ctx.user.id || members.some((m) => m.id === ctx.user.id);
    if (!keeps) {
      return { error: "Para hacerlo confidencial debes ser su responsable o miembro; si no, dejarías de verlo tú mismo. Añádete antes como miembro." };
    }
  }

  // Todo o nada: el cambio, su anotación en el historial y la reasignación de eventos.
  const moved = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(matters).set({ visibility: target }).where(eq(matters.id, matterId));
    await logAccessChange(matterId, ctx.user.id, "visibilidad", `Visibilidad: ${describeVisibility(target)}`, tx);
    return reassignLostAccessEvents(matterId, ctx.user.id, tx);
  });
  refresh(matterId);
  return { ok: `El expediente ahora es ${target}.${moved ? ` ${moved} evento(s) pendiente(s) pasaron al responsable.` : ""}` };
}

export async function addMemberAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return { error: ctx.error };
  const userId = intOrNull(formData, "userId");
  if (!userId) return { error: "Selecciona una persona." };

  const [target] = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, userId), eq(users.active, true))).limit(1);
  if (!target) return { error: "Esa persona no existe o está inactiva." };

  const added = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    const inserted = await tx
      .insert(matterMembers)
      .values({ matterId, userId, addedById: ctx.user.id })
      .onConflictDoNothing()
      .returning({ id: matterMembers.id });
    if (inserted.length > 0) await logAccessChange(matterId, ctx.user.id, "miembro_alta", `Añadido/a: ${target.name}`, tx);
    return inserted.length > 0;
  });
  if (!added) return { error: `${target.name} ya es miembro.` };
  refresh(matterId);
  return { ok: `${target.name} añadido/a.` };
}

export async function removeMemberAction(matterId: number, userId: number) {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return;

  // En un confidencial no se puede quitar a la última persona activa con acceso: nadie podría gestionarlo.
  if (ctx.matter.visibility === "confidencial") {
    const { responsible, members } = await getHolders(matterId);
    const remaining = activeHolderIds(responsible, members.filter((m) => m.id !== userId));
    if (remaining.length === 0) redirect(`/expedientes/${matterId}?tab=acceso&error=last_holder`);
  }

  const removed = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    const [row] = await tx
      .delete(matterMembers)
      .where(and(eq(matterMembers.matterId, matterId), eq(matterMembers.userId, userId)))
      .returning({ id: matterMembers.id });
    if (!row) return false;
    const [target] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId));
    await logAccessChange(matterId, ctx.user.id, "miembro_baja", `Quitado/a: ${target?.name ?? `usuario ${userId}`}`, tx);
    await reassignLostAccessEvents(matterId, ctx.user.id, tx);
    return true;
  });
  if (!removed) return;
  refresh(matterId);
  // Si quien actúa se ha quitado a sí mismo y ya no lo ve, no se le deja en una página 404.
  if (!(await getAccessibleMatter(ctx.user, matterId))) redirect("/expedientes");
}

/**
 * Procedimiento de emergencia: un expediente confidencial sin ninguna persona activa con acceso no lo
 * puede ver ni gestionar nadie. Un administrador puede reclamarlo, con un motivo obligatorio que queda
 * en el historial. Solo funciona si de verdad está huérfano; no es una puerta trasera para los demás.
 */
export async function claimOrphanMatterAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("expedientes.gestionar_acceso");
  const reason = str(formData, "reason");
  if (reason.length < 10) return { error: "Indica el motivo (mínimo 10 caracteres): quedará registrado en el expediente." };

  const orphans = await listOrphanConfidentialMatters();
  const target = orphans.find((o) => o.id === matterId);
  if (!target) return { error: "Ese expediente no está huérfano: aún tiene alguna persona activa con acceso." };

  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(matters).set({ responsibleId: admin.id }).where(eq(matters.id, matterId));
    await logAccessChange(matterId, admin.id, "reclamacion", `Acceso reclamado por ${admin.name} (expediente confidencial sin titular activo). Motivo: ${reason}`, tx);
  });
  revalidatePath("/equipo");
  revalidatePath("/expedientes");
  // La tarjeta desaparece de la lista (ya no está huérfano), así que se lleva al administrador al
  // expediente reclamado, donde el siguiente paso es reasignar el acceso en la pestaña «Acceso».
  redirect(`/expedientes/${matterId}?tab=acceso`);
}
