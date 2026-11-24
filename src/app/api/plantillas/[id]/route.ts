import { eq } from "drizzle-orm";
import { db } from "@/db";
import { docTemplates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";
import { MAX_TEMPLATE_BYTES } from "@/lib/word-templates";

export const dynamic = "force-dynamic";

/** Descarga la plantilla original (para revisarla o modificarla en Word). Requiere sesión. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });
  const [t] = await db.select().from(docTemplates).where(eq(docTemplates.id, id));
  if (!t) return new Response("No encontrado", { status: 404 });
  const buf = await readStoredFile(t.storageKey, MAX_TEMPLATE_BYTES);
  if (!buf) return new Response("El archivo no está disponible", { status: 410 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(t.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
