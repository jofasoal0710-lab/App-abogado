import { getCurrentUser } from "@/lib/auth";
import { getTemplate } from "@/lib/forms/templates";
import { logRead } from "@/lib/read-audit";
import { writingPdf } from "@/lib/writing-export";
import { getAccessibleWriting } from "@/lib/writings";

export const dynamic = "force-dynamic";

/** Descarga del escrito en PDF. Mismo acceso que la ficha del escrito (404 si no se ve). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  const w = Number.isInteger(id) ? await getAccessibleWriting(user, id) : null;
  const tpl = w ? getTemplate(w.templateKey) : null;
  if (!w || !tpl) return new Response("No encontrado", { status: 404 });
  if (w.matterId) await logRead(user, { matterId: w.matterId, kind: "documento", detail: `Descargó el escrito en PDF: ${w.title}` });
  const pdf = await writingPdf(w.title, tpl.render(w.values));
  const name = w.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80) || "escrito";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="escrito.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
      "cache-control": "private, no-store",
    },
  });
}
