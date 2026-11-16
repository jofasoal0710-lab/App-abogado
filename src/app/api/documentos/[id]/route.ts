import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { logRead } from "@/lib/read-audit";
import { openFile, presignDownload, storageDriver } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Las rutas de /api no pasan por la redirección a /login: se comprueba aquí la sesión.
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });

  // 404 tanto si no existe como si pertenece a un expediente al que no tienes acceso.
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), matterAccessSql(user, documents.matterId)))
    .limit(1);
  if (!doc) return new Response("No encontrado", { status: 404 });

  // Almacenamiento S3: tras comprobar el acceso y registrar la lectura, se redirige a una URL de 60 s.
  // (Servir el fichero a través de la función no vale: en Netlify las respuestas se limitan a ~6 MB.)
  if (storageDriver() === "s3") {
    await logRead(user, { matterId: doc.matterId, kind: "documento", detail: doc.name });
    const url = await presignDownload(doc.storageKey, doc.name, doc.mimeType);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }

  let stream: Readable;
  try {
    stream = openFile(doc.storageKey);
    // Fuerza la apertura para detectar un fichero que falte antes de responder 200.
    await new Promise<void>((resolve, reject) => {
      stream.once("open", () => resolve());
      stream.once("error", reject);
    });
  } catch {
    return new Response("El archivo no está disponible", { status: 410 });
  }

  await logRead(user, { matterId: doc.matterId, kind: "documento", detail: doc.name });

  const encoded = encodeURIComponent(doc.name);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.sizeBytes),
      // Siempre como descarga y sin que el navegador "adivine" el tipo: evita XSS por ficheros subidos.
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
