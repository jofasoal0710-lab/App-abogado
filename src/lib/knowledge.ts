import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { GUIDE } from "./knowledge-guide";

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type KnowledgeHit = Pick<KnowledgeEntry, "id" | "title" | "body" | "area" | "refs" | "source" | "reviewed"> & { rank: number; snippet: string };

/**
 * Consulta tolerante para preguntas en lenguaje natural: cualquiera de las palabras (O), con raíces en
 * español, ordenada por relevancia (título y palabras clave pesan más que el cuerpo).
 */
export const anyWordsQuery = (q: string) => sql`(case when plainto_tsquery('spanish', ${q})::text = '' then null else replace(plainto_tsquery('spanish', ${q})::text, '&', '|')::tsquery end)`;

export async function searchKnowledge(query: string, opts: { limit?: number; area?: string } = {}): Promise<KnowledgeHit[]> {
  const q = query.trim().slice(0, 300);
  if (!q) return [];
  const tsq = anyWordsQuery(q);
  const r = await db.execute(sql`
    select id, title, body, area, refs, source, reviewed,
      ts_rank_cd(search, ${tsq}, 32) as rank,
      ts_headline('spanish', body, ${tsq}, 'StartSel=[[, StopSel=]], MaxWords=45, MinWords=20, MaxFragments=2, FragmentDelimiter=" … "') as snippet
    from knowledge_entries
    where search @@ ${tsq} ${opts.area ? sql`and area = ${opts.area}` : sql``}
    order by rank desc, updated_at desc
    limit ${opts.limit ?? 20}`);
  return (r.rows as KnowledgeHit[]).map((h) => ({ ...h, rank: Number(h.rank) }));
}

/** «ley-2:28,29;ley-9342:67» → [{normKey, articles}] */
export function parseRefs(refs: string | null | undefined): { normKey: string; articles: string[] }[] {
  if (!refs) return [];
  return refs
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [normKey, arts = ""] = p.split(":");
      return { normKey: normKey.trim(), articles: arts.split(",").map((a) => a.trim()).filter(Boolean) };
    })
    .filter((r) => /^[a-z0-9-]+$/.test(r.normKey));
}

/** Carga la guía inicial (solo las entradas que aún no existan). Devuelve cuántas añadió. */
export async function loadGuide(userId: number | null): Promise<number> {
  let added = 0;
  for (const g of GUIDE) {
    const [exists] = await db.select({ id: knowledgeEntries.id }).from(knowledgeEntries).where(and(eq(knowledgeEntries.title, g.title), eq(knowledgeEntries.source, "guia")));
    if (exists) continue;
    await db.insert(knowledgeEntries).values({ ...g, source: "guia", reviewed: false, createdById: userId, updatedById: userId });
    added++;
  }
  return added;
}
