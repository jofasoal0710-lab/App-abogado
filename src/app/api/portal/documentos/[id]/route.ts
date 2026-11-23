import { Readable } from "node:stream";
import { getPortalSession } from "@/lib/portal";
import { portalDocument } from "@/lib/portal-data";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";
import { openFile, presignDownload, storageDriver } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Descarga de un documento compartido desde el portal del cliente (404 para cualquier otro). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getPortalSession();
  if (!s) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });
  const doc = await portalDocument(s.clientId, id);
  if (!doc) return new Response("No encontrado", { status: 404 });
  const { ip } = await requestMeta();
  await logSecurityEvent("portal_descarga", { ip, detail: `${s.clientName} · ${doc.matterNumber} · ${doc.name}` });

  if (storageDriver() === "s3") {
    const url = await presignDownload(doc.storageKey, doc.name, doc.mimeType);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
  let stream: Readable;
  try {
    stream = openFile(doc.storageKey);
    await new Promise<void>((resolve, reject) => {
      stream.once("open", () => resolve());
      stream.once("error", reject);
    });
  } catch {
    return new Response("El archivo no está disponible", { status: 410 });
  }
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
