import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { lawArticles, lawTexts } from "@/db/schema";
import type { ParsedArticle } from "./law-parser";

export type LoadedLaw = typeof lawTexts.$inferSelect;

/** Leyes con el texto cargado en la app, por clave del catálogo. */
export async function loadedLaws(): Promise<Map<string, LoadedLaw>> {
  const rows = await db.select().from(lawTexts);
  return new Map(rows.map((r) => [r.normKey, r]));
}

export async function getLaw(normKey: string): Promise<LoadedLaw | null> {
  const [r] = await db.select().from(lawTexts).where(eq(lawTexts.normKey, normKey));
  return r ?? null;
}

/** Índice de la ley: cada bloque (título · capítulo) con su primer y último artículo. */
export async function lawOutline(lawId: number) {
  const rows = await db
    .select({ ordinal: lawArticles.ordinal, number: lawArticles.number, heading: lawArticles.heading })
    .from(lawArticles)
    .where(eq(lawArticles.lawId, lawId))
    .orderBy(asc(lawArticles.ordinal));
  const groups: { heading: string; from: number; to: number; first: string; last: string; count: number }[] = [];
  for (const r of rows) {
    const h = r.heading ?? "Sin título";
    const g = groups.at(-1);
    if (g && g.heading === h) {
      g.to = r.ordinal;
      g.last = r.number;
      g.count++;
    } else groups.push({ heading: h, from: r.ordinal, to: r.ordinal, first: r.number, last: r.number, count: 1 });
  }
  return groups;
}

export function articlesInRange(lawId: number, from: number, to: number) {
  return db
    .select()
    .from(lawArticles)
    .where(and(eq(lawArticles.lawId, lawId), sql`${lawArticles.ordinal} between ${from} and ${to}`))
    .orderBy(asc(lawArticles.ordinal))
    .limit(200);
}

/** Artículos por número («29», «97 bis»), en el orden pedido. */
export async function articlesByNumber(lawId: number, numbers: string[]) {
  if (numbers.length === 0) return [];
  const rows = await db
    .select()
    .from(lawArticles)
    .where(and(eq(lawArticles.lawId, lawId), inArray(lawArticles.number, numbers.slice(0, 40))))
    .orderBy(asc(lawArticles.ordinal));
  const first = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!first.has(r.number)) first.set(r.number, r);
  return numbers.flatMap((n) => (first.get(n) ? [first.get(n)!] : []));
}

export type ArticleHit = { lawId: number; normKey: string; title: string; ordinal: number; number: string; heading: string | null; snippet: string };

/**
 * Búsqueda de texto completo en español (raíces: «despido» encuentra «despidos», «despedido»…).
 * Devuelve fragmentos con las coincidencias marcadas entre «[[» y «]]» (se pintan sin HTML).
 */
export async function searchArticles(query: string, opts: { lawId?: number; limit?: number } = {}): Promise<ArticleHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const tsq = sql`websearch_to_tsquery('spanish', ${q})`;
  const rows = await db.execute(sql`
    select a.law_id as "lawId", t.norm_key as "normKey", t.title, a.ordinal, a.number, a.heading,
      ts_headline('spanish', a.body, ${tsq}, 'StartSel=[[, StopSel=]], MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter=" … "') as snippet
    from law_articles a join law_texts t on t.id = a.law_id
    where a.search @@ ${tsq} ${opts.lawId ? sql`and a.law_id = ${opts.lawId}` : sql``}
    order by ts_rank(a.search, ${tsq}) desc, a.ordinal
    limit ${opts.limit ?? 30}`);
  return rows.rows as ArticleHit[];
}

/** Sustituye el texto de una ley (todo o nada). */
export async function replaceLawText(input: {
  normKey: string;
  title: string;
  versionLabel: string | null;
  sourceUrl: string | null;
  retrievedOn: string;
  articles: ParsedArticle[];
  userId: number | null;
}) {
  return db.transaction(async (tx) => {
    const [law] = await tx
      .insert(lawTexts)
      .values({
        normKey: input.normKey,
        title: input.title,
        versionLabel: input.versionLabel,
        sourceUrl: input.sourceUrl,
        retrievedOn: input.retrievedOn,
        articleCount: input.articles.length,
        loadedById: input.userId,
      })
      .onConflictDoUpdate({
        target: lawTexts.normKey,
        set: {
          title: input.title,
          versionLabel: input.versionLabel,
          sourceUrl: input.sourceUrl,
          retrievedOn: input.retrievedOn,
          articleCount: input.articles.length,
          loadedById: input.userId,
          createdAt: new Date(),
        },
      })
      .returning();
    await tx.delete(lawArticles).where(eq(lawArticles.lawId, law.id));
    for (let i = 0; i < input.articles.length; i += 200) {
      await tx.insert(lawArticles).values(input.articles.slice(i, i + 200).map((a) => ({ lawId: law.id, ordinal: a.ordinal, number: a.number, heading: a.heading, body: a.body })));
    }
    return law;
  });
}
