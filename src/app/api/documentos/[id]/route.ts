import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { openFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Las rutas de /api no pasan por la redirección a /login: se comprueba aquí la sesión.
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });

  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) return new Response("No encontrado", { status: 404 });

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
