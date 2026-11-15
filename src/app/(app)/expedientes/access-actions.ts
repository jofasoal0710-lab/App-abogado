"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { matterMembers, matters, users } from "@/db/schema";
import { intOrNull, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { logAccessChange } from "@/lib/access-log";
import { ACCESS_DENIED, canManageMatterAccess, describeVisibility } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";

/** Solo administradores y el responsable pueden gestionar el acceso. Devuelve el expediente o un error. */
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
  revalidatePath("/");
}

export async function setVisibilityAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return { error: ctx.error };
  const visibility = z.enum(["abierto", "restringido"]).safeParse(str(formData, "visibility"));
  if (!visibility.success) return { error: "Visibilidad no válida." };
  if (visibility.data === ctx.matter.visibility) return { ok: "Sin cambios." };

  await db.update(matters).set({ visibility: visibility.data }).where(eq(matters.id, matterId));
  await logAccessChange(matterId, ctx.user.id, "visibilidad", `Visibilidad: ${describeVisibility(visibility.data)}`);
  refresh(matterId);
  return { ok: `El expediente ahora es ${visibility.data}.` };
}

export async function addMemberAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return { error: ctx.error };
  const userId = intOrNull(formData, "userId");
  if (!userId) return { error: "Selecciona una persona." };

  const [target] = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, userId), eq(users.active, true))).limit(1);
  if (!target) return { error: "Esa persona no existe o está inactiva." };

  const inserted = await db
    .insert(matterMembers)
    .values({ matterId, userId, addedById: ctx.user.id })
    .onConflictDoNothing()
    .returning({ id: matterMembers.id });
  if (inserted.length === 0) return { error: `${target.name} ya es miembro.` };

  await logAccessChange(matterId, ctx.user.id, "miembro_alta", `Añadido/a: ${target.name}`);
  refresh(matterId);
  return { ok: `${target.name} añadido/a.` };
}

export async function removeMemberAction(matterId: number, userId: number) {
  const ctx = await loadManageable(matterId);
  if ("error" in ctx) return;
  const [removed] = await db
    .delete(matterMembers)
    .where(and(eq(matterMembers.matterId, matterId), eq(matterMembers.userId, userId)))
    .returning({ id: matterMembers.id });
  if (!removed) return;
  const [target] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  await logAccessChange(matterId, ctx.user.id, "miembro_baja", `Quitado/a: ${target?.name ?? `usuario ${userId}`}`);
  refresh(matterId);
}
