import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadedLaws, searchArticles } from "@/lib/laws";
import { can } from "@/lib/permissions";
import { articleLabel, Snippet } from "./law-text";
import { NEXUS_URL, NORM_AREAS, normReference, SCIJ_URL, searchNorms, type NormArea } from "@/lib/normativa";
import { OpenRegistry } from "../registros/open-registry";

export const metadata: Metadata = { title: "Normativa" };

/** Catálogo de normativa costarricense con acceso al texto vigente (SCIJ) y a la jurisprudencia (Nexus). */
export default async function NormativaPage({ searchParams }: { searchParams: Promise<{ q?: string; area?: string }> }) {
  const user = await requireUser();
  const { q = "", area = "" } = await searchParams;
  const loaded = await loadedLaws();
  // Con texto cargado, la búsqueda también mira DENTRO de los artículos (salvo si es un número de ley).
  const hits = q.trim() && loaded.size && !/^\s*(ley\s*)?\d+\s*$/i.test(q) ? await searchArticles(q, { limit: 15 }) : [];
  const validArea = area in NORM_AREAS ? (area as NormArea) : undefined;
  const found = searchNorms(q.slice(0, 100), validArea);
  const groups = (Object.keys(NORM_AREAS) as NormArea[]).map((a) => ({ area: a, norms: found.filter((n) => n.area === a) })).filter((g) => g.norms.length);

  return (
    <>
      <PageHeader
        title="Normativa costarricense"
        subtitle="Leyes y códigos de uso diario. El texto vigente se consulta en el SCIJ y la jurisprudencia en Nexus."
        actions={
          <>
            {can(user, "equipo.gestionar") && (
              <Link className="btn-secondary" href="/normativa/cargar">
                Cargar texto de una ley
              </Link>
            )}
            <OpenRegistry url={SCIJ_URL} label="Abrir SCIJ" reference={q.trim()} />
            <OpenRegistry url={NEXUS_URL} label="Abrir Nexus (jurisprudencia)" reference={q.trim()} />
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input className="input max-w-sm" type="search" name="q" defaultValue={q} placeholder="Nombre, número de ley o tema (p. ej. 7764, divorcio)" aria-label="Buscar normativa" />
        <select className="input w-auto" name="area" defaultValue={validArea ?? ""} aria-label="Materia">
          <option value="">Todas las materias</option>
          {(Object.keys(NORM_AREAS) as NormArea[]).map((a) => (
            <option key={a} value={a}>
              {NORM_AREAS[a]}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Buscar</button>
      </form>
      <p className="mb-4 text-sm text-ink-600">
        Al pulsar un botón se abre la consulta oficial y queda copiada la referencia (por ejemplo «Ley 7764») para pegarla en el buscador. Para citar una norma en un expediente, usa su pestaña «Normativa».
      </p>

      {hits.length > 0 && (
        <section className="card mb-6">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Artículos que tratan «{q.trim()}»</h2>
          <ul className="divide-y divide-ink-100">
            {hits.map((h) => (
              <li key={`${h.lawId}-${h.ordinal}`} className="px-5 py-3">
                <Link className="font-medium text-brand-700 hover:underline" href={`/normativa/${h.normKey}?art=${encodeURIComponent(h.number)}`}>
                  {articleLabel(h.number)} · {h.title}
                </Link>
                <p className="mt-1 text-sm text-ink-700">
                  <Snippet text={h.snippet} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState title="Sin resultados en el catálogo">Busca directamente en el SCIJ con el botón de arriba: la referencia escrita queda copiada.</EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.area} className="card">
              <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">{NORM_AREAS[g.area]}</h2>
              <ul className="divide-y divide-ink-100">
                {g.norms.map((n) => (
                  <li key={n.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-medium text-ink-900">{n.name}</p>
                      <p className="text-xs text-ink-500">
                        {n.number ? `Ley N.° ${n.number}` : "Norma suprema"}
                        {loaded.has(n.key) && <span className="badge-green ml-2">Texto en la app · {loaded.get(n.key)!.articleCount} artículos</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {loaded.has(n.key) && (
                        <Link className="btn-primary btn-sm" href={`/normativa/${n.key}`}>
                          Leer en la app
                        </Link>
                      )}
                      <OpenRegistry url={SCIJ_URL} label="Texto en SCIJ" reference={normReference(n)} />
                      <OpenRegistry url={NEXUS_URL} label="Jurisprudencia" reference={normReference(n)} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
