import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { deedParties, deeds } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { getNotaryProfile } from "@/lib/notary";
import { quincena, quincenaOf, shiftQuincena } from "@/lib/notary-period";
import { PrintButton } from "../../escritos/[id]/print-button";
import { NotaryNav } from "../notary-nav";

export const metadata: Metadata = { title: "Índice notarial" };

/** Índice quincenal de escrituras (para presentarlo al Archivo Notarial). */
export default async function NotaryIndexPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("notaria.usar");
  const q = quincena((await searchParams).q ?? "") ?? quincenaOf(todayISO());
  const profile = await getNotaryProfile(user.id);
  const rows = await db
    .select()
    .from(deeds)
    .where(and(eq(deeds.notaryId, user.id), gte(deeds.grantedOn, q.start), lte(deeds.grantedOn, q.end)))
    .orderBy(asc(deeds.number));
  const parties = rows.length ? await db.select().from(deedParties).where(inArray(deedParties.deedId, rows.map((r) => r.id))).orderBy(asc(deedParties.id)) : [];
  const byDeed = new Map<number, string[]>();
  for (const p of parties) byDeed.set(p.deedId, [...(byDeed.get(p.deedId) ?? []), p.name]);

  return (
    <>
      <PageHeader
        title="Índice notarial"
        subtitle={q.label}
        actions={
          <>
            <a href={`/api/notaria/indice?q=${q.key}`} className="btn-secondary">
              Descargar CSV
            </a>
            <PrintButton />
          </>
        }
      />
      <NotaryNav current="/notaria/indice" />
      <div className="no-print mb-4 flex items-center gap-2">
        <Link className="btn-secondary btn-sm" href={`/notaria/indice?q=${shiftQuincena(q.key, -1)}`}>
          ‹ Quincena anterior
        </Link>
        <Link className="btn-secondary btn-sm" href="/notaria/indice">
          Actual
        </Link>
        <Link className="btn-secondary btn-sm" href={`/notaria/indice?q=${shiftQuincena(q.key, 1)}`}>
          Siguiente ›
        </Link>
      </div>
      <section className="card overflow-x-auto">
        <div className="border-b border-ink-100 px-5 py-3 text-sm text-ink-700">
          <p className="font-medium">{profile?.fullName ?? user.name}</p>
          <p className="text-xs text-ink-500">
            {profile?.barNumber ? `Carné ${profile.barNumber} · ` : ""}
            {q.label}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Sin escrituras en esta quincena">Si no otorgaste ninguna, el índice se presenta igualmente en blanco.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Fecha y hora</th>
                <th>Acto o contrato</th>
                <th>Comparecientes</th>
                <th>Tomo · folios</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="tabular-nums">{d.number}</td>
                  <td className="whitespace-nowrap">
                    {formatDate(d.grantedOn)}
                    {d.grantedAt ? ` · ${d.grantedAt}` : ""}
                  </td>
                  <td>{d.act}</td>
                  <td>{(byDeed.get(d.id) ?? []).join(", ") || "—"}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {d.volume ?? "—"} · {d.folioStart ?? "—"}
                    {d.folioEnd && d.folioEnd !== d.folioStart ? `–${d.folioEnd}` : ""}
                  </td>
                  <td>{d.status === "no_paso" ? "No pasó" : "Otorgada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
