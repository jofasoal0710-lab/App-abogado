import "server-only";
import { extensionOf } from "./file-types";

/**
 * Qué documentos se pueden ver dentro de la app y cómo:
 *  - pdf: en el visor del navegador (marco de la propia app).
 *  - image: png, jpg, gif, webp (nunca SVG, que puede llevar código).
 *  - word: .docx convertido a HTML en el servidor y limpiado (sin scripts, enlaces solo http/https/mailto).
 *  - text: .txt y .csv como texto plano.
 * El resto (xls, doc antiguo, msg…) se descarga.
 */
export type ViewKind = "pdf" | "image" | "word" | "text" | null;
export const MAX_VIEW_BYTES = 25 * 1024 * 1024;

export function viewKind(name: string): ViewKind {
  const ext = extensionOf(name);
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (ext === "docx") return "word";
  if (ext === "txt" || ext === "csv") return "text";
  return null;
}

/** El contenido es realmente del tipo que dice la extensión (firma de los primeros bytes). */
export function matchesSignature(kind: ViewKind, name: string, data: Buffer): boolean {
  const ext = extensionOf(name);
  const head = data.subarray(0, 12);
  if (kind === "pdf") return head.subarray(0, 5).toString("latin1") === "%PDF-";
  if (kind === "word") return head[0] === 0x50 && head[1] === 0x4b; // ZIP (Office Open XML)
  if (kind === "image") {
    if (ext === "png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (ext === "jpg" || ext === "jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (ext === "gif") return head.subarray(0, 4).toString("latin1") === "GIF8";
    if (ext === "webp") return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
    return false;
  }
  return kind === "text";
}

export const INLINE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** .docx → HTML limpio para mostrarlo dentro de la app. */
export async function docxToSafeHtml(data: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const sanitize = (await import("sanitize-html")).default;
  const { value } = await mammoth.convertToHtml({ buffer: data });
  return sanitize(value, {
    allowedTags: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "sup", "sub", "br", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "a", "img", "blockquote"],
    allowedAttributes: { a: ["href"], img: ["src", "alt"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: { a: sanitize.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
  });
}
