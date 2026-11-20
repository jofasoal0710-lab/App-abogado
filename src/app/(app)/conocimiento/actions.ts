"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { requirePermission, requireUser, type CurrentUser } from "@/lib/auth";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-guide";
import { loadGuide } from "@/lib/knowledge";
import { can } from "@/lib/permissions";

const schema = z.object({
  title: z.string().trim().min(3, "Escribe un título").max(200),
  body: z.string().trim().min(10, "Escribe el contenido").max(20_000),
  area: z.string().refine((a) => a in KNOWLEDGE_AREAS, "Elige un área"),
  keywords: z.string().trim().max(1000).nullable(),
  refs: z
    .string()
    .trim()
    .max(500)
    .regex(/^([a-z0-9-]+(:[0-9a-zA-Z ,]+)?\s*;?\s*)*$/, "Referencias con el formato ley-2:28,29; ley-9342:67")
    .nullable(),
});

function parse(formData: FormData) {
  return schema.safeParse({
    title: str(formData, "title"),
    body: str(formData, "body"),
    area: str(formData, "area"),
    keywords: optStr(formData, "keywords"),
    refs: optStr(formData, "refs"),
  });
}

/** Quien la escribió, o quien gestiona el equipo, puede corregirla o borrarla. */
async function editable(user: CurrentUser, id: number) {
  const [e] = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, id));
  if (!e) return null;
  return e.createdById === user.id || can(user, "equipo.gestionar") ? e : null;
}

export async function createKnowledgeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = parse(formData);
  if (!p.success) return { error: firstZodError(p.error) };
  const [e] = await db.insert(knowledgeEntries).values({ ...p.data, source: "despacho", reviewed: can(user, "equipo.gestionar"), createdById: user.id, updatedById: user.id }).returning({ id: knowledgeEntries.id });
  revalidatePath("/conocimiento");
  redirect(`/conocimiento?ok=creada#k${e.id}`);
}

export async function updateKnowledgeAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await editable(user, id))) return { error: "Solo quien la escribió o quien gestiona el equipo puede corregirla." };
  const p = parse(formData);
  if (!p.success) return { error: firstZodError(p.error) };
  await db.update(knowledgeEntries).set({ ...p.data, updatedById: user.id, updatedAt: new Date() }).where(eq(knowledgeEntries.id, id));
  revalidatePath("/conocimiento");
  redirect(`/conocimiento?ok=guardada#k${id}`);
}

export async function deleteKnowledgeAction(id: number) {
  const user = await requireUser();
  if (!(await editable(user, id))) return;
  await db.delete(knowledgeEntries).where(eq(knowledgeEntries.id, id));
  revalidatePath("/conocimiento");
}

export async function markReviewedAction(id: number) {
  const user = await requirePermission("equipo.gestionar");
  await db.update(knowledgeEntries).set({ reviewed: true, updatedById: user.id, updatedAt: new Date() }).where(and(eq(knowledgeEntries.id, id)));
  revalidatePath("/conocimiento");
}

export async function loadGuideAction() {
  const user = await requirePermission("equipo.gestionar");
  const n = await loadGuide(user.id);
  revalidatePath("/conocimiento");
  redirect(`/conocimiento?ok=guia-${n}`);
}
