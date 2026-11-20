import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { EmptyState, PageHeader, Pagination, Stat } from "@/components/ui";
import { db } from "@/db";
import { deeds } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { getNotaryProfile, nextDeedNumber, pendingIndexes } from "@/lib/notary";
import { IndexAlert } from "@/components/index-alert";
import { quincenaOf } from "@/lib/notary-period";
import { pageParam } from "@/lib/search";
import { NotaryNav } from "./notary-nav";

export const metadata: Metadata = { title: "Gestor notarial" };
const PAGE = 25;

/** Protocolo del notario: solo sus propias escrituras. */
export default async function NotaryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission("notaria.usar");
  const profile = await getNotaryProfile(user.id);
  const page = pageParam((await searchParams).page);
  const [[{ total }], rows, next] = await Promise.all([
    db.select({ total: count() }).from(deeds).where(eq(deeds.notaryId, user.id)),
    db.select().from(deeds).where(eq(deeds.notaryId, user.id)).orderBy(desc(deeds.number)).limit(PAGE).offset((page - 1) * PAGE),
    nextDeedNumber(user.id),
  ]);
  const q = quincenaOf(todayISO());
  const indexPending = profile ? await pendingIndexes(user.id, todayISO()) : [];

  return (
    <>
      <PageHeader
        title="Gestor notarial"
        subtitle={profile ? `${profile.fullName} · protocolo personal y reservado` : "Configura tu perfil de notario para empezar."}
        actions={
          profile && (
            <>
              <Link href="/formularios#escrituras" className="btn-secondary">
                Redactar con formulario
              </Link>
              <Link href="/notaria/escrituras/nueva" className="btn-primary">
                Registrar escritura
              </Link>
            </>
          )
        }
      />
      <NotaryNav current="/notaria" />
      {!profile ? (
        <div className="card card-pad">
          <p className="text-ink-700">Antes de registrar escrituras, completa tu perfil: nombre, carné, oficina, tomo en uso y folio actual.</p>
          <Link href="/notaria/perfil" className="btn-primary mt-4">
            Completar perfil de notario
          </Link>
        </div>
      ) : (
        <>
          <IndexAlert pending={indexPending} />
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Próxima escritura" value={`N.º ${next}`} icon="notario" />
            <Stat label="Tomo y folio actuales" value={`${profile.currentVolume ?? "—"} · ${profile.nextFolio}`} icon="documentos" />
            <Stat label="Índice en curso" value={q.label.replace(/ de \d{4}$/, "")} href={`/notaria/indice?q=${q.key}`} icon="agenda" />
          </div>
          <section className="card overflow-x-auto">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Protocolo</h2>
            {rows.length === 0 ? (
              <EmptyState title="Aún no hay escrituras">Regístralas aquí o redáctalas con un formulario notarial: se numeran solas.</EmptyState>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Fecha</th>
                    <th>Acto o contrato</th>
                    <th>Tomo · folios</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="row-link">
                      <td className="tabular-nums">
                        <Link href={`/notaria/escrituras/${d.id}`} className="link">
                          {d.number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(d.grantedOn)}</td>
                      <td>{d.act}</td>
                      <td className="whitespace-nowrap tabular-nums">
                        {d.volume ?? "—"} · {d.folioStart ?? "—"}
                        {d.folioEnd && d.folioEnd !== d.folioStart ? `–${d.folioEnd}` : ""}
                      </td>
                      <td>{d.status === "no_paso" ? <span className="badge-amber">No pasó</span> : <span className="badge-green">Otorgada</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination page={page} pageSize={PAGE} total={total} hrefFor={(p) => `/notaria?page=${p}`} />
          </section>
        </>
      )}
    </>
  );
}
