"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documents, matters } from "@/db/schema";
import { optStr, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { ALLOWED_TYPES, formatBytes, mimeForFilename, sanitizeFilename } from "@/lib/file-types";
import { deleteFile, saveFile } from "@/lib/storage";

export async function uploadDocumentAction(
  matterId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo." };
  if (file.size > config.maxUploadBytes) {
    return { error: `El archivo supera el máximo de ${formatBytes(config.maxUploadBytes)}.` };
  }

  const name = sanitizeFilename(file.name);
  const mimeType = mimeForFilename(name);
  if (!mimeType) {
    return { error: `Tipo de archivo no permitido. Formatos admitidos: ${Object.keys(ALLOWED_TYPES).join(", ")}.` };
  }

  const [matter] = await db.select({ id: matters.id }).from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) return { error: "El expediente no existe." };

  const storageKey = await saveFile(Buffer.from(await file.arrayBuffer()), name);
  try {
    await db.insert(documents).values({
      matterId,
      name,
      category: optStr(formData, "category"),
      mimeType,
      sizeBytes: file.size,
      storageKey,
      uploadedById: user.id,
    });
  } catch (err) {
    await deleteFile(storageKey); // no dejar ficheros huérfanos si falla la base de datos
    throw err;
  }

  revalidatePath("/documentos");
  revalidatePath(`/expedientes/${matterId}`);
  return { ok: `«${name}» subido correctamente.` };
}

export async function deleteDocumentAction(documentId: number) {
  const user = await requireUser();
  if (user.role === "asistente") return;

  const [doc] = await db.delete(documents).where(eq(documents.id, documentId)).returning();
  if (!doc) return;
  await deleteFile(doc.storageKey);
  revalidatePath("/documentos");
  revalidatePath(`/expedientes/${doc.matterId}`);
}
