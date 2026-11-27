import { getCurrentUser } from "@/lib/auth";
import { writingDocx } from "@/lib/docx-export";
import { getTemplate } from "@/lib/forms/templates";
import { logRead } from "@/lib/read-audit";
import { getAccessibleWriting } from "@/lib/writings";

export const dynamic = "force-dynamic";

/**
 * Descarga en Word (.docx de verdad): carta, Times New Roman 12, márgenes de 2,5 cm, numeración de páginas
 * y los [PENDIENTE] resaltados. Mismo acceso que la ficha del escrito (404 si no se ve).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  const w = Number.isInteger(id) ? await getAccessibleWriting(user, id) : null;
  const tpl = w ? getTemplate(w.templateKey) : null;
  if (!w || !tpl) return new Response("No encontrado", { status: 404 });
  if (w.matterId) await logRead(user, { matterId: w.matterId, kind: "documento", detail: `Descargó el escrito: ${w.title}` });

  const bytes = writingDocx(w.title, tpl.render(w.values), { author: user.name });
  const name = w.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80) || "escrito";
  // Nombre de respaldo sin tildes, para navegadores que no leen «filename*».
  const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").trim() || "escrito";
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${ascii}.docx"; filename*=UTF-8''${encodeURIComponent(name)}.docx`,
      "cache-control": "no-store",
    },
  });
}
