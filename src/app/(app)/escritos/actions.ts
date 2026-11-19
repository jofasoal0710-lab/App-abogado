"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { writings } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { cleanValues, missingRequired } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { getAccessibleWriting } from "@/lib/writings";

function readValues(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("f_")) raw[k.slice(2)] = v;
  return raw;
}

/** Genera un escrito (o escritura) y lo enlaza al expediente. */
export async function createWritingAction(templateKey: string, matterId: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tpl = getTemplate(templateKey);
  if (!tpl) return { error: "Ese formulario no existe." };
  if (tpl.kind === "escrito" && matterId === null) return { error: "Elige el expediente al que pertenece el escrito." };
  if (matterId !== null && !(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };

  const values = cleanValues(tpl, readValues(formData));
  const missing = missingRequired(tpl, values);
  if (missing.length) return { error: `Falta: ${missing.join(", ")}.` };

  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || tpl.title;
  const [row] = await db.insert(writings).values({ matterId, templateKey: tpl.key, kind: tpl.kind, title, values, createdById: user.id }).returning({ id: writings.id });
  if (matterId !== null) revalidatePath(`/expedientes/${matterId}`);
  redirect(`/escritos/${row.id}?creado=1`);
}

/** Corrige los campos de un escrito ya generado (se vuelve a redactar con los valores nuevos). */
export async function updateWritingAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const w = await getAccessibleWriting(user, id);
  if (!w) return { error: "Ese escrito no existe o no tienes acceso." };
  const tpl = getTemplate(w.templateKey);
  if (!tpl) return { error: "El formulario de este escrito ya no existe." };
  const values = cleanValues(tpl, readValues(formData));
  const missing = missingRequired(tpl, values);
  if (missing.length) return { error: `Falta: ${missing.join(", ")}.` };
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || tpl.title;
  await db.update(writings).set({ values, title, updatedAt: new Date() }).where(eq(writings.id, id));
  if (w.matterId !== null) revalidatePath(`/expedientes/${w.matterId}`);
  redirect(`/escritos/${id}?guardado=1`);
}

export async function deleteWritingAction(id: number) {
  const user = await requireUser();
  const w = await getAccessibleWriting(user, id);
  if (!w) redirect("/formularios");
  // Lo borra quien lo redactó o quien puede borrar documentos.
  const { can } = await import("@/lib/permissions");
  if (w.createdById !== user.id && !can(user, "documentos.borrar")) redirect(`/escritos/${id}?error=forbidden`);
  await db.delete(writings).where(and(eq(writings.id, id)));
  redirect(w.matterId !== null ? `/expedientes/${w.matterId}?tab=escritos` : "/formularios");
}
