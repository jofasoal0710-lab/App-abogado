import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, type Crumb } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { articleNumbersFrom } from "@/lib/law-parser";
import { articlesByNumber, articlesInRange, getLaw, lawOutline, searchArticles } from "@/lib/laws";
import { getNorm, NEXUS_URL, NORM_AREAS, normLabel, normReference, SCIJ_URL } from "@/lib/normativa";
import { OpenRegistry } from "../../registros/open-registry";
import { ArticleCard, articleLabel, Snippet } from "../law-text";
import { SelectBox, SelectionBar } from "../selection";

const SEL_FORM = "seleccion-articulos";

/** «Titulo segundo: De los contratos… · Capitulo sexto: De la suspensión…» → migas cortas con el texto completo al pasar el ratón. */
function headingCrumbs(heading: string | null | undefined): Crumb[] {
  if (!heading) return [];
  return heading.split(" · ").map((part) => {
    const short = part.split(":")[0].trim();
    return { label: short.length > 3 ? short : part, title: part };
  });
}

export const metadata: Metadata = { title: "Texto de la ley" };

/** Una ley leída dentro de la app: índice por títulos y capítulos, búsqueda y artículos. */
export default async function LawPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ q?: string; art?: string; desde?: string; hasta?: string; seleccionar?: string }> }) {
  await requireUser();
  const { key } = await params;
  const norm = getNorm(key);
  const law = norm ? await getLaw(key) : null;
  if (!norm || !law) notFound();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const art = (sp.art ?? "").trim().slice(0, 60);
  const cite = (n: string) => `/normativa/citar?norma=${key}&art=${encodeURIComponent(n)}`;
  // «Seleccionar varios»: casillas en cada artículo; los enlaces conservan el modo.
  const selecting = sp.seleccionar === "1";
  const selForm = selecting ? SEL_FORM : undefined;
  const qs = (extra: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") u.set(k, String(v));
    if (selecting) u.set("seleccionar", "1");
    const t = u.toString();
    return `/normativa/${key}${t ? `?${t}` : ""}`;
  };
  const current = { q: q || undefined, art: art || undefined, desde: sp.desde, hasta: sp.hasta };
  const toggleSelect = (() => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) if (v) u.set(k, v);
    if (!selecting) u.set("seleccionar", "1");
    const t = u.toString();
    return `/normativa/${key}${t ? `?${t}` : ""}`;
  })();

  // ¿«29» o «28 y 29» en el buscador? Se muestran esos artículos; si no, búsqueda por palabras.
  const asNumbers = articleNumbersFrom(art || (/^[\d\s,y\-al]+(bis|ter)?$/i.test(q) ? q : ""));
  const direct = asNumbers.length ? await articlesByNumber(law.id, asNumbers) : null;
  const hits = !direct && q ? await searchArticles(q, { lawId: law.id, limit: 40 }) : null;
  const from = Number(sp.desde), to = Number(sp.hasta);
  const range = !direct && !hits && Number.isInteger(from) && Number.isInteger(to) && to >= from ? await articlesInRange(law.id, from, Math.min(to, from + 150)) : null;
  const outline = !direct && !hits && !range ? await lawOutline(law.id) : null;

  // Ruta de acceso: Normativa › materia › ley › título/capítulo › lo que se está viendo.
  const shown = direct?.[0] ?? range?.[0] ?? null;
  const crumbs: Crumb[] = [
    { label: "Normativa", href: "/normativa" },
    { label: NORM_AREAS[norm.area], href: `/normativa#${norm.area}` },
    { label: norm.name, href: `/normativa/${key}` },
    ...(range || (direct && direct.length === 1) ? headingCrumbs(shown?.heading) : []),
    direct
      ? { label: direct.length === 1 ? articleLabel(direct[0].number) : `Artículos ${art || q}` }
      : hits
        ? { label: `Búsqueda: «${q}»` }
        : range
          ? { label: range.length ? `Arts. ${range[0].number} a ${range[range.length - 1].number}` : "Artículos" }
          : { label: "Índice" },
  ];

  return (
    <>
      <Breadcrumbs items={crumbs} />
      {selecting && <form id={SEL_FORM} action="/normativa/citar" method="get" hidden><input type="hidden" name="norma" value={key} /></form>}
      <PageHeader
        title={norm.name}
        subtitle={`${norm.number ? `Ley N.° ${norm.number} · ` : ""}${law.articleCount} artículos · ${law.versionLabel ?? "versión cargada"} · copia del ${formatDate(law.retrievedOn)}`}
        actions={
          <>
            <Link className={selecting ? "btn-primary" : "btn-secondary"} href={toggleSelect} aria-pressed={selecting}>
              {selecting ? "Terminar selección" : "Seleccionar varios"}
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
        {selecting && <input type="hidden" name="seleccionar" value="1" />}
        <input className="input max-w-md" type="search" name="q" defaultValue={q || art} placeholder="Número de artículo (29, 28 y 29) o palabras (despido, preaviso…)" aria-label={`Buscar en ${norm.name}`} />
        <button className="btn-primary">Buscar</button>
        {(q || art || range) && (
          <Link className="btn-secondary" href={qs({})}>
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
                <ArticleCard a={a} lawTitle={normLabel(norm)} citeHref={cite(a.number)} selectForm={selForm} />
                <p className="px-5 pb-3 text-xs">
                  <Link className="link" href={`${qs({ desde: Math.max(1, a.ordinal - 2), hasta: a.ordinal + 2 })}#art-${a.number.replace(/\s+/g, "-")}`}>
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
                {selForm && <SelectBox formId={selForm} number={h.number} label={articleLabel(h.number)} />}
                <Link className="font-medium text-brand-700 hover:underline" href={qs({ art: h.number })}>
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
              <ArticleCard a={a} lawTitle={normLabel(norm)} citeHref={cite(a.number)} selectForm={selForm} />
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
                <Link className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5 hover:bg-ink-50" href={qs({ desde: g.from, hasta: g.to })}>
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

      {selecting && outline && (
        <p className="no-print mt-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Modo «Seleccionar varios»: abre un capítulo o busca para marcar los artículos que quieras añadir al expediente.
        </p>
      )}
      {selecting && <SelectionBar formId={SEL_FORM} cancelHref={toggleSelect} storageKey={`seleccion-${key}`} />}
    </>
  );
}
