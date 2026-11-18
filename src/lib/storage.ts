import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";

/**
 * Almacenamiento de documentos con dos drivers:
 *  - local (por defecto): disco en UPLOAD_DIR. Para servidor propio con disco persistente.
 *  - s3: cualquier almacenamiento compatible con S3 (Cloudflare R2, AWS S3, Backblaze B2, MinIO…).
 *    Necesario en Netlify: su disco es efímero y las funciones no admiten cuerpos de más de ~6 MB,
 *    así que el navegador sube DIRECTAMENTE al bucket con una URL prefirmada.
 */
export type StorageDriver = "local" | "s3";

export function storageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

const KEY_PATTERN = /^[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/;

/** ¿Es una clave creada por esta aplicación? (lo demás que haya en el bucket no se toca nunca). */
export function isAppKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

function assertKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Clave de almacenamiento no válida");
}

/** Clave nueva: UUID + extensión saneada. Nunca el nombre original (puede traer caracteres peligrosos). */
export function newStorageKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 9);
  return `${randomUUID()}${ext.length > 1 ? ext : ""}`;
}

/* ---------------- local ---------------- */

function baseDir() {
  return path.resolve(config.uploadDir);
}

function localPath(key: string): string {
  assertKey(key);
  return path.join(baseDir(), key);
}

export async function saveFile(data: Buffer, originalName: string): Promise<string> {
  const key = newStorageKey(originalName);
  await mkdir(baseDir(), { recursive: true });
  await writeFile(localPath(key), data, { flag: "wx" });
  return key;
}

export function openFile(key: string) {
  return createReadStream(localPath(key));
}

/* ---------------- s3 ---------------- */

let client: S3Client | undefined;

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("Falta S3_BUCKET (STORAGE_DRIVER=s3).");
  return b;
}

function s3(): S3Client {
  if (client) return client;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error("Faltan S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.");
  client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
    // Las versiones recientes del SDK añaden sumas de verificación por defecto que rompen las URLs
    // prefirmadas en Cloudflare R2, Backblaze y otros: solo se calculan cuando el servicio las exige.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/** URL para que el navegador suba el fichero directamente al bucket (PUT, caduca en 10 min). */
export async function presignUpload(key: string): Promise<string> {
  assertKey(key);
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 600 });
}

/** Tamaño real del objeto en el bucket, o null si no existe. */
export async function objectSize(key: string): Promise<number | null> {
  assertKey(key);
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return r.ContentLength ?? null;
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/** URL de descarga de vida muy corta (60 s), siempre como adjunto y con el tipo MIME que nosotros guardamos. */
export async function presignDownload(key: string, filename: string, mimeType: string): Promise<string> {
  assertKey(key);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ResponseContentType: mimeType,
    }),
    { expiresIn: 60 },
  );
}

/** Recorre todos los objetos del bucket (paginado). */
export async function* listStoredObjects(): AsyncGenerator<{ key: string; lastModified: Date }> {
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) yield { key: o.Key, lastModified: o.LastModified ?? new Date(0) };
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

/** Borra sin fallar si el fichero ya no existe. */
export async function deleteFile(key: string): Promise<void> {
  assertKey(key);
  if (storageDriver() === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })); // S3 no falla si no existe
    return;
  }
  try {
    await unlink(localPath(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
