import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { lawArticles, lawTexts } from "@/db/schema";
import type { Citation } from "./demand-analysis";
import { readStoredFile } from "./storage";
import { rtfToText, sniffDocument } from "./doc-text";

export { isReadableDemand } from "./doc-text";

/** Tamaño máximo de una demanda para analizarla (texto sacado del PDF o Word). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 400_000;

export type Extracted = { ok: true; text: string; pages?: number } | { ok: false; error: string };

/**
 * Texto de un documento guardado (PDF con texto, Word .docx o .txt), sin enviarlo a ningún servicio.
 * Un PDF escaneado (solo imágenes) no tiene texto: se avisa para que se pegue el texto a mano.
 */
export async function extractStoredText(storageKey: string, mimeType: string): Promise<Extracted> {
  const data = await readStoredFile(storageKey, MAX_FILE_BYTES);
  if (!data) return { ok: false, error: "No se pudo leer el documento (falta o supera los 20 MB)." };
  try {
    let text = "";
    let pages: number | undefined;
    // El formato se reconoce por el contenido (un .doc puede venir como «application/octet-stream»).
    const kind = sniffDocument(data, mimeType);
    if (kind === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const r = await extractText(pdf, { mergePages: false });
      pages = r.totalPages;
      text = (r.text as string[]).join("\n\n");
    } else if (kind === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: data })).value;
    } else if (kind === "doc") {
      // Word 97-2003 (.doc): se lee en el servidor, sin programas externos.
      const WordExtractor = (await import("word-extractor")).default;
      const doc = await new WordExtractor().extract(data);
      text = [doc.getHeaders?.({ includeFooters: false }) ?? "", doc.getBody(), doc.getFootnotes?.() ?? ""].filter(Boolean).join("\n\n");
    } else if (kind === "rtf") {
      text = rtfToText(data.toString("latin1"));
    } else if (kind === "txt") {
      text = data.toString("utf8");
    } else {
      return { ok: false, error: "Solo se pueden analizar demandas en PDF, Word (.doc o .docx), RTF o texto. Si es otro formato, pega el texto." };
    }
    const words = text.split(/\s+/).filter((w) => /[a-záéíóúñ]{2}/i.test(w)).length;
    if (words < 40) {
      return { ok: false, error: "El documento casi no tiene texto: parece un escaneo (imágenes). Copia el texto de la demanda y pégalo en «Pegar el texto»." };
    }
    return { ok: true, text: text.slice(0, MAX_TEXT), pages };
  } catch (err) {
    console.error("[contestar] No se pudo extraer el texto:", err);
    return { ok: false, error: "No se pudo leer el texto del documento (¿está protegido o dañado?). Pega el texto a mano." };
  }
}

export type CheckedCitation = Citation & { loaded: boolean; found: string[]; missing: string[] };

/** Comprueba cada cita contra los textos de ley cargados en la app (¿existe el artículo citado?). */
export async function checkCitations(citations: Citation[]): Promise<CheckedCitation[]> {
  const keys = [...new Set(citations.map((c) => c.normKey).filter((k): k is string => !!k))];
  if (!keys.length) return [];
  const laws = await db.select({ id: lawTexts.id, key: lawTexts.normKey }).from(lawTexts).where(inArray(lawTexts.normKey, keys));
  const byKey = new Map(laws.map((l) => [l.key, l.id]));
  const out: CheckedCitation[] = [];
  for (const c of citations) {
    const lawId = c.normKey ? byKey.get(c.normKey) : undefined;
    if (!lawId) {
      out.push({ ...c, loaded: false, found: [], missing: [] });
      continue;
    }
    const rows = await db.select({ n: lawArticles.number }).from(lawArticles).where(and(eq(lawArticles.lawId, lawId), inArray(lawArticles.number, c.articles)));
    const found = new Set(rows.map((r) => r.n));
    out.push({ ...c, loaded: true, found: c.articles.filter((a) => found.has(a)), missing: c.articles.filter((a) => !found.has(a)) });
  }
  return out;
}
