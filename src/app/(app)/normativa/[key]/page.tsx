import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { articleNumbersFrom } from "@/lib/law-parser";
import { articlesByNumber, articlesInRange, getLaw, lawOutline, searchArticles } from "@/lib/laws";
import { getNorm, NEXUS_URL, normLabel, normReference, SCIJ_URL } from "@/lib/normativa";
import { OpenRegistry } from "../../registros/open-registry";
import { ArticleCard, articleLabel, Snippet } from "../law-text";

export const metadata: Metadata = { title: "Texto de la ley" };

/** Una ley leída dentro de la app: índice por títulos y capítulos, búsqueda y artículos. */
export default async function LawPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ q?: string; art?: string; desde?: string; hasta?: string }> }) {
  await requireUser();
  const { key } = await params;
  const norm = getNorm(key);
  const law = norm ? await getLaw(key) : null;
  if (!norm || !law) notFound();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const art = (sp.art ?? "").trim().slice(0, 60);
  const cite = (n: string) => `/normativa/citar?norma=${key}&art=${encodeURIComponent(n)}`;

  // ¿«29» o «28 y 29» en el buscador? Se muestran esos artículos; si no, búsqueda por palabras.
  const asNumbers = articleNumbersFrom(art || (/^[\d\s,y\-al]+(bis|ter)?$/i.test(q) ? q : ""));
  const direct = asNumbers.length ? await articlesByNumber(law.id, asNumbers) : null;
  const hits = !direct && q ? await searchArticles(q, { lawId: law.id, limit: 40 }) : null;
  const from = Number(sp.desde), to = Number(sp.hasta);
  const range = !direct && !hits && Number.isInteger(from) && Number.isInteger(to) && to >= from ? await articlesInRange(law.id, from, Math.min(to, from + 150)) : null;
  const outline = !direct && !hits && !range ? await lawOutline(law.id) : null;

  return (
    <>
      <PageHeader
        title={norm.name}
        subtitle={`${norm.number ? `Ley N.° ${norm.number} · ` : ""}${law.articleCount} artículos · ${law.versionLabel ?? "versión cargada"} · copia del ${formatDate(law.retrievedOn)}`}
        actions={
          <>
            <Link className="btn-secondary" href="/normativa">
              Volver a normativa
            </Link>
            <OpenRegistry url={SCIJ_URL} label="Ver en SCIJ" reference={normReference(norm)} />
            <OpenRegistry url={NEXUS_URL} label="Jurisprudencia" reference={normReference(norm)} />
          </>
        }
      />
      <p className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
        Texto copiado del SCIJ (SINALEVI) el {formatDate(law.retrievedOn)}. No se actualiza solo: ante una reforma reciente, confirma en el SCIJ.
      </p>
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <input className="input max-w-md" type="search" name="q" defaultValue={q || art} placeholder="Número de artículo (29, 28 y 29) o palabras (despido, preaviso…)" aria-label={`Buscar en ${norm.name}`} />
        <button className="btn-primary">Buscar</button>
        {(q || art || range) && (
          <Link className="btn-secondary" href={`/normativa/${key}`}>
            Índice
          </Link>
        )}
      </form>

      {direct && (
        <section className="card">
          {direct.length === 0 ? (
            <EmptyState title="No encontré ese artículo">Revisa el número o busca por palabras.</EmptyState>
          ) : (
            direct.map((a) => (
              <div key={a.id}>
                {a.heading && <p className="px-5 pt-4 text-xs text-ink-500">{a.heading}</p>}
                <ArticleCard a={a} lawTitle={normLabel(norm)} citeHref={cite(a.number)} />
                <p className="px-5 pb-3 text-xs">
                  <Link className="link" href={`/normativa/${key}?desde=${Math.max(1, a.ordinal - 2)}&hasta=${a.ordinal + 2}#art-${a.number.replace(/\s+/g, "-")}`}>
                    Ver los artículos de alrededor
                  </Link>
                </p>
              </div>
            ))
          )}
        </section>
      )}

      {hits && (
        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">
            {hits.length === 0 ? `Sin resultados para «${q}»` : `${hits.length}${hits.length === 40 ? "+" : ""} artículos sobre «${q}»`}
          </h2>
          <ul className="divide-y divide-ink-100">
            {hits.map((h) => (
              <li key={h.ordinal} className="px-5 py-3">
                <Link className="font-medium text-brand-700 hover:underline" href={`/normativa/${key}?art=${encodeURIComponent(h.number)}`}>
                  {articleLabel(h.number)}
                </Link>
                {h.heading && <span className="ml-2 text-xs text-ink-500">{h.heading}</span>}
                <p className="mt-1 text-sm text-ink-700">
                  <Snippet text={h.snippet} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {range && (
        <section className="card">
          {range.map((a, i) => (
            <div key={a.id}>
              {a.heading && a.heading !== range[i - 1]?.heading && <p className="bg-ink-50 px-5 py-2 text-xs font-medium text-ink-600">{a.heading}</p>}
              <ArticleCard a={a} lawTitle={normLabel(norm)} citeHref={cite(a.number)} />
            </div>
          ))}
        </section>
      )}

      {outline && (
        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Índice</h2>
          <ul className="divide-y divide-ink-100">
            {outline.map((g) => (
              <li key={g.from}>
                <Link className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 hover:bg-ink-50" href={`/normativa/${key}?desde=${g.from}&hasta=${g.to}`}>
                  <span className="text-sm text-ink-800">{g.heading}</span>
                  <span className="whitespace-nowrap text-xs text-ink-500">
                    {g.first === g.last ? `Art. ${g.first}` : `Arts. ${g.first} a ${g.last}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
