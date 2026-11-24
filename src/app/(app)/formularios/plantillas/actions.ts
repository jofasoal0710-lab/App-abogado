"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { docTemplates, documents } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requirePermission, requireUser } from "@/lib/auth";
import { asActor, stampSessionActor } from "@/lib/data-audit";
import { deleteFile, readStoredFile, saveServerFile } from "@/lib/storage";
import { FIELD_NAME, MAX_TEMPLATE_BYTES, TemplateError, inspectTemplate, outputName, renderTemplate } from "@/lib/word-templates";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Sube una plantilla .docx: se comprueba que se puede usar y se guardan sus campos. */
export async function uploadTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("plantillas.gestionar");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige el archivo .docx de la plantilla." };
  if (!/\.docx$/i.test(file.name)) return { error: "La plantilla debe ser un documento de Word .docx (no .doc ni .docm)." };
  if (file.size > MAX_TEMPLATE_BYTES) return { error: "La plantilla supera los 5 MB." };
  const name = (str(formData, "name").trim() || file.name.replace(/\.docx$/i, "")).slice(0, 150);
  const buf = Buffer.from(await file.arrayBuffer());
  let fields: string[];
  try {
    fields = inspectTemplate(buf);
  } catch (err) {
    if (err instanceof TemplateError) return { error: err.message };
    throw err;
  }
  const key = await saveServerFile(buf, file.name, DOCX);
  try {
    await db.insert(docTemplates).values({ name, description: str(formData, "description").trim().slice(0, 500) || null, fileName: file.name.slice(0, 200), storageKey: key, sizeBytes: buf.length, fields, createdById: user.id });
  } catch (err) {
    await deleteFile(key);
    throw err;
  }
  revalidatePath("/formularios/plantillas");
  return { ok: fields.length ? `Plantilla «${name}» guardada con ${fields.length} campo(s): ${fields.map((f) => `{${f}}`).join(", ")}.` : `Plantilla «${name}» guardada. No tiene campos: se generará tal cual.` };
}

export async function deleteTemplateAction(id: number): Promise<void> {
  const user = await requirePermission("plantillas.gestionar");
  const [t] = await asActor(user.id, (tx) => tx.delete(docTemplates).where(eq(docTemplates.id, id)).returning({ key: docTemplates.storageKey }));
  // Los documentos ya generados con ella no se tocan: son copias guardadas en sus expedientes.
  if (t) await deleteFile(t.key).catch(() => {});
  revalidatePath("/formularios/plantillas");
}

/**
 * Genera el Word rellenado con los valores revisados y lo guarda en los documentos del expediente.
 * Solo se usan los campos que tiene la plantilla; los valores llegan del formulario (ya corregidos).
 */
export async function generateFromTemplateAction(matterId: number, templateId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter) return { error: ACCESS_DENIED };
  const [t] = await db.select().from(docTemplates).where(eq(docTemplates.id, templateId));
  if (!t) return { error: "Esa plantilla ya no existe." };
  const values: Record<string, string> = {};
  for (const f of t.fields) if (FIELD_NAME.test(f)) values[f] = str(formData, `f_${f}`).slice(0, 5000);
  const original = await readStoredFile(t.storageKey, MAX_TEMPLATE_BYTES);
  if (!original) return { error: "No se encuentra el archivo de la plantilla en el almacenamiento." };
  let out: Buffer;
  try {
    out = renderTemplate(original, values);
  } catch (err) {
    if (err instanceof TemplateError) return { error: err.message };
    throw err;
  }
  const name = outputName(str(formData, "fileName").trim() || t.name, matter.number);
  const key = await saveServerFile(out, name, DOCX);
  let docId: number;
  try {
    const [d] = await db.transaction(async (tx) => {
      await stampSessionActor(tx);
      return tx.insert(documents).values({ matterId, name, category: "Plantilla Word", mimeType: DOCX, sizeBytes: out.length, storageKey: key, uploadedById: user.id }).returning({ id: documents.id });
    });
    docId = d.id;
  } catch (err) {
    await deleteFile(key);
    throw err;
  }
  revalidatePath(`/expedientes/${matterId}`);
  revalidatePath("/documentos");
  redirect(`/expedientes/${matterId}?tab=documentos&generado=${docId}`);
}
