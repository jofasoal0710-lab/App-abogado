import { getCurrentUser } from "@/lib/auth";
import { ordinal, type Block } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { logRead } from "@/lib/read-audit";
import { getAccessibleWriting } from "@/lib/writings";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "titulo":
          return `<p class="c"><b>${esc(b.text)}</b></p>`;
        case "encabezado":
          return `<p><b>${esc(b.text)}</b></p>`;
        case "seccion":
          return `<p style="margin-top:14pt"><b>${esc(b.text)}</b></p>`;
        case "p":
          return `<p class="j">${esc(b.text)}</p>`;
        case "ordinales":
          return b.items.map((it, i) => `<p class="j"><b>${ordinal(i)}:</b> ${esc(it)}</p>`).join("");
        case "firma":
          return `<p class="c" style="margin-top:40pt">${b.lines.map((l) => (l ? esc(l) : "______________________________")).join("<br>")}</p>`;
      }
    })
    .join("\n");
}

/**
 * Descarga para Word: un documento HTML que Word abre y permite editar y guardar como .docx. Mismo
 * acceso que la ficha del escrito (404 si no se ve).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  const w = Number.isInteger(id) ? await getAccessibleWriting(user, id) : null;
  const tpl = w ? getTemplate(w.templateKey) : null;
  if (!w || !tpl) return new Response("No encontrado", { status: 404 });
  if (w.matterId) await logRead(user, { matterId: w.matterId, kind: "documento", detail: `Descargó el escrito: ${w.title}` });

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(w.title)}</title>
<style>@page{size:21.59cm 27.94cm;margin:2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.8}p{margin:0 0 8pt}.j{text-align:justify}.c{text-align:center}</style></head><body>${toHtml(tpl.render(w.values))}</body></html>`;
  const name = w.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80) || "escrito";
  return new Response("﻿" + html, {
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": `attachment; filename="escrito.doc"; filename*=UTF-8''${encodeURIComponent(name)}.doc`,
      "cache-control": "no-store",
    },
  });
}
