import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "@/db";
import { intakeFiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { openFile, presignDownload, storageDriver } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Adjunto de una solicitud de nuevo cliente: solo para quien revisa solicitudes, siempre como descarga. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!can(user, "solicitudes.gestionar")) return new Response("No encontrado", { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });
  const [f] = await db.select().from(intakeFiles).where(eq(intakeFiles.id, id)).limit(1);
  if (!f) return new Response("No encontrado", { status: 404 });

  if (storageDriver() === "s3") {
    const url = await presignDownload(f.storageKey, f.name, f.mimeType);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
  let stream: Readable;
  try {
    stream = openFile(f.storageKey);
    await new Promise<void>((resolve, reject) => {
      stream.once("open", () => resolve());
      stream.once("error", reject);
    });
  } catch {
    return new Response("El archivo no está disponible", { status: 410 });
  }
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Length": String(f.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
