import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { INLINE_TYPES, matchesSignature, MAX_VIEW_BYTES, viewKind } from "@/lib/doc-viewer";
import { extensionOf } from "@/lib/file-types";
import { readStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * PDF o imagen para verlos DENTRO de la app (en un marco de la propia página del documento).
 * Solo si el contenido coincide con su tipo (firma de bytes); nunca HTML ni SVG; nada de scripts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), matterAccessSql(user, documents.matterId))).limit(1);
  if (!doc) return new Response("No encontrado", { status: 404 });
  const kind = viewKind(doc.name);
  if (kind !== "pdf" && kind !== "image") return new Response("Este tipo de documento no se muestra así", { status: 415 });
  const data = await readStoredFile(doc.storageKey, MAX_VIEW_BYTES);
  if (!data) return new Response("El archivo no está disponible o es demasiado grande para verlo", { status: 410 });
  if (!matchesSignature(kind, doc.name, data)) return new Response("El contenido no corresponde a su tipo; descárgalo para revisarlo", { status: 415 });
  // (La lectura se registra al abrir la página del visor.)
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": INLINE_TYPES[extensionOf(doc.name)],
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      // Las imágenes no necesitan nada más. Al PDF no se le pone una CSP restrictiva: el visor del navegador
      // la hereda y dejaría de funcionar; su seguridad la dan el tipo fijo, nosniff y la firma comprobada.
      ...(kind === "image" ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'" } : {}),
      "Cache-Control": "private, no-store",
    },
  });
}
