"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { matterCitations } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { getNorm } from "@/lib/normativa";

const schema = z.object({
  normKey: z.string().nullable(),
  customName: z.string().trim().max(300).nullable(),
  customNumber: z.string().trim().max(30).nullable(),
  articles: z.string().trim().max(200).nullable(),
  note: z.string().trim().max(1000).nullable(),
});

/** Cita una norma en el expediente (del catálogo o escrita a mano, p. ej. un reglamento o un voto). */
export async function addCitationAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const parsed = schema.safeParse({
    normKey: optStr(formData, "normKey"),
    customName: optStr(formData, "customName"),
    customNumber: optStr(formData, "customNumber"),
    articles: optStr(formData, "articles"),
    note: optStr(formData, "note"),
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const d = parsed.data;
  const norm = d.normKey && d.normKey !== "otra" ? getNorm(d.normKey) : undefined;
  if (d.normKey && d.normKey !== "otra" && !norm) return { error: "Esa norma no está en el catálogo." };
  const name = norm?.name ?? d.customName;
  if (!name) return { error: "Elige una norma del catálogo o escribe su nombre." };
  await db.insert(matterCitations).values({
    matterId,
    normKey: norm?.key ?? null,
    normName: name,
    normNumber: norm ? norm.number : (d.customNumber?.replace(/^ley\s*/i, "") || null),
    articles: d.articles,
    note: d.note,
    createdById: user.id,
  });
  revalidatePath(`/expedientes/${matterId}`);
  return { ok: "Norma citada en el expediente." };
}

export async function deleteCitationAction(matterId: number, citationId: number) {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, matterId))) return;
  await db.delete(matterCitations).where(and(eq(matterCitations.id, citationId), eq(matterCitations.matterId, matterId)));
  revalidatePath(`/expedientes/${matterId}`);
}
