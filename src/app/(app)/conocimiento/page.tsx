import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ConfirmButton } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { knowledgeEntries, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-guide";
import { parseRefs, searchKnowledge } from "@/lib/knowledge";
import { loadedLaws } from "@/lib/laws";
import { getNorm } from "@/lib/normativa";
import { can } from "@/lib/permissions";
import { Snippet } from "../normativa/law-text";
import { deleteKnowledgeAction, loadGuideAction, markReviewedAction } from "./actions";

export const metadata: Metadata = { title: "Base de conocimiento" };

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; area?: string; ok?: string }> }) {
  const user = await requireUser();
  const { q = "", area = "", ok } = await searchParams;
  const validArea = area in KNOWLEDGE_AREAS ? area : undefined;
  const manager = can(user, "equipo.gestionar");
  const hits = q.trim() ? await searchKnowledge(q, { area: validArea, limit: 40 }) : null;
  const rows = hits
    ? null
    : await db
        .select({ e: knowledgeEntries, author: users.name })
        .from(knowledgeEntries)
        .leftJoin(users, eq(users.id, knowledgeEntries.updatedById))
        .where(validArea ? eq(knowledgeEntries.area, validArea) : sql`true`)
        .orderBy(knowledgeEntries.area, desc(knowledgeEntries.updatedAt))
        .limit(300);
  const loaded = await loadedLaws();
  const [{ guide }] = await db.select({ guide: sql<number>`count(*) filter (where source = 'guia')::int` }).from(knowledgeEntries);
  const entries = hits
    ? hits.map((h) => ({ e: { ...h, keywords: null, createdById: null, updatedAt: null as Date | null }, author: null as string | null, snippet: h.snippet }))
    : rows!.map((r) => ({ ...r, snippet: null as string | null }));

  return (
    <>
      <PageHeader
        title="Base de conocimiento"
        subtitle="Procedimientos, plazos y criterios del despacho. El asistente responde con lo que hay aquí."
        actions={
          <>
            {manager && guide === 0 && (
              <form action={loadGuideAction}>
                <button className="btn-secondary">Cargar guía inicial (Costa Rica)</button>
              </form>
            )}
            <Link className="btn-primary" href="/conocimiento/nueva">
              Nueva entrada
            </Link>
          </>
        }
      />
      {ok && (
        <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok.startsWith("guia-") ? `Guía inicial cargada: ${ok.slice(5)} entradas. Están marcadas «sin revisar» hasta que el despacho las revise.` : ok === "creada" ? "Entrada guardada." : "Cambios guardados."}
        </p>
      )}
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input className="input max-w-md" type="search" name="q" defaultValue={q} placeholder="Busca como preguntarías: «plazo para apelar», «cesantía»…" aria-label="Buscar en la base de conocimiento" />
        <select className="input w-auto" name="area" defaultValue={validArea ?? ""} aria-label="Área">
          <option value="">Todas las áreas</option>
          {Object.entries(KNOWLEDGE_AREAS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Buscar</button>
      </form>

      {entries.length === 0 ? (
        <EmptyState title={q ? `Nada sobre «${q}»` : "Aún no hay entradas"}>
          {q ? "Prueba con otras palabras o crea una entrada nueva." : "Escribe la primera entrada o carga la guía inicial."}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {entries.map(({ e, author, snippet }) => {
            const refs = parseRefs(e.refs);
            const mine = e.createdById === user.id || manager;
            return (
              <article key={e.id} id={`k${e.id}`} className="card card-pad scroll-mt-24">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-ink-900">{e.title}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span className="badge-blue">{KNOWLEDGE_AREAS[e.area] ?? e.area}</span>
                      {e.source === "guia" && <span className="badge-gray">Guía inicial</span>}
                      {!e.reviewed && <span className="badge-amber">Sin revisar</span>}
                      {e.updatedAt && (
                        <span>
                          {author ? `${author} · ` : ""}
                          {formatDate(e.updatedAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  {!hits && mine && (
                    <div className="no-print flex flex-wrap gap-1">
                      {manager && !e.reviewed && (
                        <form action={markReviewedAction.bind(null, e.id)}>
                          <button className="btn-ghost btn-sm">Marcar revisada</button>
                        </form>
                      )}
                      <Link className="btn-ghost btn-sm" href={`/conocimiento/${e.id}/editar`}>
                        Corregir
                      </Link>
                      <form action={deleteKnowledgeAction.bind(null, e.id)}>
                        <ConfirmButton message={`¿Borrar «${e.title}»?`} className="btn-ghost btn-sm text-red-700">
                          Borrar
                        </ConfirmButton>
                      </form>
                    </div>
                  )}
                </div>
                {snippet ? (
                  <p className="mt-2 text-sm text-ink-700">
                    <Snippet text={snippet} />{" "}
                    <Link className="link" href={`/conocimiento?area=${e.area}#k${e.id}`}>
                      Leer completa
                    </Link>
                  </p>
                ) : (
                  <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-800">{e.body}</div>
                )}
                {refs.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2 text-xs">
                    {refs.flatMap((r) => {
                      const n = getNorm(r.normKey);
                      if (!n) return [];
                      return r.articles.length && loaded.has(r.normKey)
                        ? r.articles.map((a) => (
                            <Link key={`${r.normKey}-${a}`} className="badge-gray hover:underline" href={`/normativa/${r.normKey}?art=${encodeURIComponent(a)}`}>
                              Art. {a} · {n.name}
                            </Link>
                          ))
                        : [
                            <Link key={r.normKey} className="badge-gray hover:underline" href={`/normativa?q=${encodeURIComponent(n.number ?? n.name)}`}>
                              {r.articles.length ? `Arts. ${r.articles.join(", ")} · ` : ""}
                              {n.name}
                            </Link>,
                          ];
                    })}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
