"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { optStr, type ActionState } from "@/lib/actions";
import { canAccessDocument, getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { ALLOWED_TYPES, formatBytes, mimeForFilename, sanitizeFilename } from "@/lib/file-types";
import { deleteFile, newStorageKey, objectSize, presignUpload, saveFile, storageDriver } from "@/lib/storage";
import { signUploadToken, verifyUploadToken } from "@/lib/upload-token";

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

  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };

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
  if (!(await canAccessDocument(user, documentId))) return;

  const [doc] = await db.delete(documents).where(eq(documents.id, documentId)).returning();
  if (!doc) return;
  await deleteFile(doc.storageKey);
  revalidatePath("/documentos");
  revalidatePath(`/expedientes/${doc.matterId}`);
}

/* ---------- Subida directa al bucket (driver s3) ---------- */

const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

function tokenSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET no está definido");
  return s;
}

/**
 * Paso 1: valida y devuelve una URL prefirmada para que el navegador suba el fichero directamente al
 * bucket (sin pasar por el servidor, que en Netlify admite como máximo ~6 MB por petición), más un
 * token firmado que autoriza el registro posterior.
 */
export async function prepareUploadAction(
  matterId: number,
  input: { name: string; size: number; category: string | null },
): Promise<{ error: string } | { url: string; token: string }> {
  const user = await requireUser();
  if (storageDriver() !== "s3") return { error: "La subida directa no está activa en este despliegue." };

  const name = sanitizeFilename(String(input?.name ?? ""));
  const size = Number(input?.size);
  if (!Number.isInteger(size) || size <= 0) return { error: "Selecciona un archivo." };
  if (size > config.maxUploadBytes) return { error: `El archivo supera el máximo de ${formatBytes(config.maxUploadBytes)}.` };
  const mime = mimeForFilename(name);
  if (!mime) return { error: `Tipo de archivo no permitido. Formatos admitidos: ${Object.keys(ALLOWED_TYPES).join(", ")}.` };
  const category = typeof input?.category === "string" && input.category.trim() ? input.category.trim().slice(0, 100) : null;
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };

  const key = newStorageKey(name);
  const url = await presignUpload(key);
  const token = signUploadToken({ key, matterId, name, size, category, mime, userId: user.id, exp: Date.now() + UPLOAD_TOKEN_TTL_MS }, tokenSecret());
  return { url, token };
}

/**
 * Paso 3: tras subir el fichero, comprueba EN EL BUCKET que existe y mide exactamente lo autorizado, y
 * entonces lo registra. Si no coincide, se borra del bucket y no se registra nada.
 */
export async function finalizeUploadAction(token: string): Promise<ActionState> {
  const user = await requireUser();
  const claim = verifyUploadToken(String(token ?? ""), tokenSecret());
  if (!claim || claim.userId !== user.id) return { error: "La subida no es válida o ha caducado. Inténtalo de nuevo." };
  if (!(await getAccessibleMatter(user, claim.matterId))) return { error: ACCESS_DENIED };

  const size = await objectSize(claim.key);
  if (size === null) return { error: "El archivo no llegó al almacenamiento. Inténtalo de nuevo." };
  if (size !== claim.size || size > config.maxUploadBytes) {
    await deleteFile(claim.key); // no dejar basura ni ficheros con un tamaño distinto del declarado
    return { error: "El archivo subido no coincide con lo declarado y se ha descartado." };
  }

  await db
    .insert(documents)
    .values({
      matterId: claim.matterId,
      name: claim.name,
      category: claim.category,
      mimeType: claim.mime,
      sizeBytes: claim.size,
      storageKey: claim.key,
      uploadedById: user.id,
    })
    .onConflictDoNothing(); // finalizar dos veces el mismo token no duplica el documento

  revalidatePath("/documentos");
  revalidatePath(`/expedientes/${claim.matterId}`);
  return { ok: `«${claim.name}» subido correctamente.` };
}
