"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { matterCitations } from "@/db/schema";
import { firstZodError, optStr, str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requirePermission, requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseLawText } from "@/lib/law-parser";
import { replaceLawText } from "@/lib/laws";
import { getNorm } from "@/lib/normativa";
import { redirect } from "next/navigation";

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

/** Cita un artículo de una ley (desde el lector de la ley) en el expediente elegido. */
export async function citeArticleAction(normKey: string, articles: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const matterId = Number(str(formData, "matterId"));
  if (!Number.isInteger(matterId) || !(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const norm = getNorm(normKey);
  if (!norm) return { error: "Esa norma no está en el catálogo." };
  await db.insert(matterCitations).values({
    matterId,
    normKey: norm.key,
    normName: norm.name,
    normNumber: norm.number,
    articles: articles.slice(0, 200) || null,
    note: optStr(formData, "note")?.slice(0, 1000) ?? null,
    createdById: user.id,
  });
  revalidatePath(`/expedientes/${matterId}`);
  redirect(`/expedientes/${matterId}?tab=normativa`);
}

const MAX_TEXT = 5_000_000;

/** Carga (o sustituye) el texto completo de una ley del catálogo, pegado o en un .txt. */
export async function loadLawTextAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("equipo.gestionar");
  const norm = getNorm(str(formData, "normKey"));
  if (!norm) return { error: "Elige la ley del catálogo." };
  let text = str(formData, "text");
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_TEXT) return { error: "El archivo es demasiado grande (máximo 5 MB de texto)." };
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") return { error: "Sube el texto como archivo .txt (o pégalo en el cuadro)." };
    text = await file.text();
  }
  if (text.length > MAX_TEXT) return { error: "El texto es demasiado largo (máximo 5 MB)." };
  const articles = parseLawText(text);
  if (articles.length < 3) return { error: "No encontré artículos en ese texto. Copia el texto completo desde el SCIJ (que incluya «ARTÍCULO 1.-…»)." };
  const sourceUrl = optStr(formData, "sourceUrl");
  if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) return { error: "El enlace de origen debe empezar por https://" };
  const retrievedOn = str(formData, "retrievedOn") || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn) || retrievedOn > todayISO()) return { error: "La fecha de la copia no es válida." };
  await replaceLawText({
    normKey: norm.key,
    title: norm.name,
    versionLabel: optStr(formData, "versionLabel")?.slice(0, 120) ?? null,
    sourceUrl,
    retrievedOn,
    articles,
    userId: user.id,
  });
  revalidatePath("/normativa");
  revalidatePath(`/normativa/${norm.key}`);
  return { ok: `${norm.name}: ${articles.length} artículos cargados.` };
}
