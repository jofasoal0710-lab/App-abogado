"use server";

import { requireUser } from "@/lib/auth";
import { articleNumbersFrom } from "@/lib/law-parser";
import { articlesByNumber, loadedLaws, searchArticles } from "@/lib/laws";
import { citationText, getNorm, normLabel, searchNorms } from "@/lib/normativa";
import { checkFields, type FieldIssues } from "@/lib/spellcheck";

export type PickerResult = {
  key: string;
  label: string;
  /** Cita lista para el fundamento de derecho. */
  citation: string;
  /** Texto del artículo (si la ley está cargada en la app). */
  text: string | null;
  snippet: string | null;
};

/** Límite sencillo por persona (las búsquedas se lanzan al escribir). */
const recent = new Map<number, number[]>();
function limited(userId: number, max: number) {
  const now = Date.now();
  const mine = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= max) return true;
  recent.set(userId, [...mine, now]);
  return false;
}

/**
 * Buscador del formulario: «29 código de trabajo», «artículo 97 bis trabajo», «preaviso» o «7764».
 * Devuelve citas listas para añadir al fundamento de derecho (con el texto si la ley está cargada).
 */
export async function lawPickerSearchAction(raw: string): Promise<PickerResult[]> {
  const user = await requireUser();
  if (limited(user.id, 60)) return [];
  const q = String(raw ?? "").trim().slice(0, 120);
  if (q.length < 2) return [];
  const loaded = await loadedLaws();

  // «29 código de trabajo» / «art. 28 y 29 trabajo»
  const m = /^(?:art(?:[ií]culos?|s?\.)?\s*)?((?:\d+(?:\s*bis)?)(?:\s*(?:,|y|al|-)\s*\d+(?:\s*bis)?)*)\s+(?:del?\s+)?(.+)$/i.exec(q);
  if (m) {
    const norms = searchNorms(m[2]);
    const out: PickerResult[] = [];
    for (const n of norms.slice(0, 3)) {
      const law = loaded.get(n.key);
      const numbers = articleNumbersFrom(m[1]);
      const arts = law ? await articlesByNumber(law.id, numbers) : [];
      if (arts.length) {
        for (const a of arts)
          out.push({ key: `${n.key}-${a.number}`, label: `Artículo ${a.number} · ${n.name}`, citation: citationText({ normName: n.name, normNumber: n.number, articles: a.number }), text: a.body, snippet: a.body.slice(0, 220) });
      } else {
        out.push({ key: `${n.key}-${m[1]}`, label: `Artículos ${m[1]} · ${normLabel(n)}`, citation: citationText({ normName: n.name, normNumber: n.number, articles: m[1] }), text: null, snippet: law ? "No encontré ese artículo en el texto cargado." : "Texto no cargado en la app: se añade solo la cita." });
      }
    }
    if (out.length) return out.slice(0, 10);
  }

  // Una ley del catálogo («código de trabajo», «7764»)
  const norms = searchNorms(q).slice(0, 4);
  const fromCatalog: PickerResult[] = norms.map((n) => ({ key: n.key, label: normLabel(n), citation: citationText({ normName: n.name, normNumber: n.number, articles: null }), text: null, snippet: loaded.has(n.key) ? "Escribe el número delante para un artículo concreto (p. ej. «29 trabajo»)." : null }));

  // Palabras en los textos cargados («preaviso», «vacaciones»)
  const hits = loaded.size ? await searchArticles(q, { limit: 8 }) : [];
  const fromText: PickerResult[] = await Promise.all(
    hits.map(async (h) => {
      const n = getNorm(h.normKey)!;
      const [a] = await articlesByNumber(h.lawId, [h.number]);
      return { key: `${h.normKey}-${h.number}`, label: `Artículo ${h.number} · ${n.name}`, citation: citationText({ normName: n.name, normNumber: n.number, articles: h.number }), text: a?.body ?? null, snippet: h.snippet };
    }),
  );
  return [...fromText, ...fromCatalog].slice(0, 12);
}

/** Revisa la ortografía y el estilo de los campos de texto de un formulario (en el servidor). */
export async function checkSpellingAction(fields: { field: string; label: string; text: string }[]): Promise<FieldIssues[]> {
  const user = await requireUser();
  if (limited(user.id, 30)) return [];
  const clean = (Array.isArray(fields) ? fields : [])
    .slice(0, 60)
    .map((f) => ({ field: String(f.field).slice(0, 60), label: String(f.label).slice(0, 120), text: String(f.text ?? "").slice(0, 50_000) }));
  return checkFields(clean);
}
