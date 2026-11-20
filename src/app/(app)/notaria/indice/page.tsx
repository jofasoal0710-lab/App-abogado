import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { CopyButton } from "@/components/copy-button";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { deedParties, deeds, notaryIndexSubmissions } from "@/db/schema";
import { INDEX_URL, indexRow, indexState } from "@/lib/notary-index";
import { markIndexSubmittedAction, undoIndexSubmissionAction } from "../actions";
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
  const byDeed = new Map<number, { name: string; idNumber: string | null }[]>();
  for (const p of parties) byDeed.set(p.deedId, [...(byDeed.get(p.deedId) ?? []), { name: p.name, idNumber: p.idNumber }]);
  const today = todayISO();
  const [submission] = await db
    .select()
    .from(notaryIndexSubmissions)
    .where(and(eq(notaryIndexSubmissions.notaryId, user.id), eq(notaryIndexSubmissions.period, q.key)));
  const state = indexState(q, today, submission ?? null);
  const indexRows = rows.map((d) => indexRow({ ...d, parties: byDeed.get(d.id) ?? [] }));
  const header = ["N.º", "Fecha", "Hora", "Acto o contrato", "Tomo", "Folios", "Comparecientes"].join("\t");

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
      <section className="no-print card card-pad mb-4" aria-labelledby="index-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="index-title" className="font-serif text-lg font-semibold">
              Presentación en INDEX (Archivo Nacional)
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              {state.kind === "presentado" && (
                <>
                  <span className="badge-green mr-2">Presentado</span>el {formatDate(state.on)}
                  {state.receipt ? ` · acuse ${state.receipt}` : ""}
                </>
              )}
              {state.kind === "en_curso" && (
                <>
                  <span className="badge-blue mr-2">Quincena en curso</span>Se presenta del {formatDate(q.end)} en adelante; vence el {formatDate(state.due)}.
                </>
              )}
              {state.kind === "pendiente" && (
                <>
                  <span className="badge-amber mr-2">Pendiente</span>Vence el {formatDate(state.due)}
                  {state.daysLeft === 0 ? " (hoy)" : ` (en ${state.daysLeft} ${state.daysLeft === 1 ? "día" : "días"})`}.
                </>
              )}
              {state.kind === "vencido" && (
                <>
                  <span className="badge-red mr-2">Vencido</span>El plazo terminó el {formatDate(state.due)}.
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Plazo: 5 días hábiles tras el cierre de la quincena. Si no hubo escrituras, se presenta igualmente en blanco.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rows.length > 0 && <CopyButton text={[header, ...indexRows].join("\n")} label="Copiar índice completo" className="btn-secondary btn-sm" />}
            <a className="btn-primary btn-sm" href={INDEX_URL} target="_blank" rel="noopener noreferrer">
              Abrir INDEX
            </a>
          </div>
        </div>
        {state.kind === "presentado" ? (
          <form action={undoIndexSubmissionAction.bind(null, q.key)} className="mt-3">
            <ConfirmButton message="¿Quitar la marca de presentado de este índice?" className="btn-ghost btn-sm">
              Quitar la marca de presentado
            </ConfirmButton>
          </form>
        ) : (
          state.kind !== "en_curso" && (
            <ActionForm action={markIndexSubmittedAction.bind(null, q.key)} className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
              <Field label="Fecha de presentación">
                <input className="input" type="date" name="submittedOn" defaultValue={today} max={today} required />
              </Field>
              <Field label="Acuse o número de INDEX (opcional)">
                <input className="input" name="receipt" maxLength={120} />
              </Field>
              <SubmitButton>Marcar como presentado</SubmitButton>
            </ActionForm>
          )
        )}
      </section>

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
                <th className="no-print w-px" />
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
                  <td>
                    {(byDeed.get(d.id) ?? []).map((p, i) => (
                      <span key={i} className="block">
                        {p.name}
                        {p.idNumber && <span className="text-xs text-ink-500"> · {p.idNumber}</span>}
                      </span>
                    ))}
                    {(byDeed.get(d.id) ?? []).length === 0 && "—"}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {d.volume ?? "—"} · {d.folioStart ?? "—"}
                    {d.folioEnd && d.folioEnd !== d.folioStart ? `–${d.folioEnd}` : ""}
                  </td>
                  <td>{d.status === "no_paso" ? "No pasó" : "Otorgada"}</td>
                  <td className="no-print">
                    <CopyButton text={indexRows[rows.indexOf(d)]} label="Copiar fila" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
