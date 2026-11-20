import { getCurrentUser } from "@/lib/auth";
import { getTemplate } from "@/lib/forms/templates";
import { wordPreviewPage, writingPdf } from "@/lib/writing-export";
import { getAccessibleWriting } from "@/lib/writings";

export const dynamic = "force-dynamic";

/** Vista previa del escrito dentro de la app: ?formato=pdf (por defecto) o ?formato=word. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  const w = Number.isInteger(id) ? await getAccessibleWriting(user, id) : null;
  const tpl = w ? getTemplate(w.templateKey) : null;
  if (!w || !tpl) return new Response("No encontrado", { status: 404 });
  const blocks = tpl.render(w.values);
  if (new URL(req.url).searchParams.get("formato") === "word") {
    // Contenido propio y escapado; aun así, sin scripts ni nada externo.
    return new Response(wordPreviewPage(w.title, blocks), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",
        "cache-control": "private, no-store",
      },
    });
  }
  const pdf = await writingPdf(w.title, blocks);
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": "inline", "cache-control": "private, no-store" },
  });
}
