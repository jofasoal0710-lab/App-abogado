import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

const KEY_PATTERN = /^[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/;

function baseDir() {
  return path.resolve(config.uploadDir);
}

/** Ruta absoluta de un fichero guardado. Rechaza claves que no hayamos generado nosotros. */
function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("Clave de almacenamiento no válida");
  return path.join(baseDir(), key);
}

export async function saveFile(data: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 9);
  const key = `${randomUUID()}${ext.length > 1 ? ext : ""}`;
  await mkdir(baseDir(), { recursive: true });
  await writeFile(resolveKey(key), data, { flag: "wx" });
  return key;
}

export function openFile(key: string) {
  return createReadStream(resolveKey(key));
}

/** Borra sin fallar si el fichero ya no existe. */
export async function deleteFile(key: string): Promise<void> {
  try {
    await unlink(resolveKey(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
