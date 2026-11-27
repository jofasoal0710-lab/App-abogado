import { isReadableDemand } from "@/lib/doc-text";
import type { Metadata } from "next";
import { HelpButton } from "@/components/help/help-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Breadcrumbs, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { demandAnalyses, documents } from "@/db/schema";
import { requireMatterPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { PROCESSES, progress, sanitizeAnswers, type DemandAnalysis } from "@/lib/demand-analysis";
import { startDemandAnalysisAction } from "../../contestar-actions";

export const metadata: Metadata = { title: "Contestar una demanda" };


/** Paso 1: elegir la demanda recibida (documento del expediente o texto pegado) para analizarla. */
export default async function AnswerDemandStartPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const matterId = Number((await params).id);
  if (!Number.isInteger(matterId)) notFound();
  const matter = await requireMatterPage(user, matterId);
  const [docs, analyses] = await Promise.all([
    db.select({ id: documents.id, name: documents.name, mimeType: documents.mimeType, createdAt: documents.createdAt }).from(documents).where(eq(documents.matterId, matterId)).orderBy(desc(documents.createdAt)).then((rows) => rows.filter((d) => isReadableDemand(d.name, d.mimeType))),
    db.select({ id: demandAnalyses.id, sourceName: demandAnalyses.sourceName, analysis: demandAnalyses.analysis, answers: demandAnalyses.answers, updatedAt: demandAnalyses.updatedAt, writingId: demandAnalyses.writingId }).from(demandAnalyses).where(eq(demandAnalyses.matterId, matterId)).orderBy(desc(demandAnalyses.updatedAt)),
  ]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Expedientes", href: "/expedientes" }, { label: matter.number, href: `/expedientes/${matterId}?tab=escritos` }, { label: "Contestar una demanda" }]} />
      <div className="flex items-center gap-2" data-tour="titulo">
            <h1 className="font-serif text-2xl font-semibold">Contestar una demanda</h1>
            <HelpButton />
          </div>
      <p className="mt-1 max-w-3xl text-sm text-ink-600">
        La app lee la demanda que presentó la otra parte, separa sus hechos, pretensiones y pruebas, calcula el plazo y te guía para responder cada hecho como exige la ley. Con tus respuestas redacta la contestación. Todo se hace dentro de la app: el documento no se envía a ningún servicio externo.
      </p>

      {analyses.length > 0 && (
        <section className="card mt-6" aria-labelledby="previos">
          <h2 id="previos" className="border-b border-ink-100 px-5 py-3 font-semibold">Demandas analizadas</h2>
          <ul className="divide-y divide-ink-100">
            {analyses.map((a) => {
              const an = a.analysis as DemandAnalysis;
              const pr = progress(an, sanitizeAnswers(a.answers, an));
              return (
                <li key={a.id}>
                  <Link href={`/expedientes/${matterId}/contestar/${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-ink-50">
                    <span className="font-medium">{a.sourceName}</span>
                    <span className="badge-blue">{PROCESSES[an.process].label}</span>
                    <span className={pr.facts === pr.total && pr.total ? "badge-green" : "badge-amber"}>
                      {pr.facts} de {pr.total} hechos respondidos
                    </span>
                    {a.writingId && <span className="badge-gray">Contestación redactada</span>}
                    <span className="ml-auto text-xs text-ink-500">{formatDateTime(a.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card card-pad mt-6" aria-labelledby="nueva">
        <h2 id="nueva" className="font-semibold">Analizar una demanda</h2>
        <ActionForm action={startDemandAnalysisAction.bind(null, matterId)} className="mt-3 space-y-4">
          {docs.length ? (
            <label className="block max-w-xl">
              <span className="label">Documento del expediente (PDF, Word o texto)</span>
              <select className="input" name="documentId" defaultValue={docs[0].id}>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <EmptyState title="Este expediente aún no tiene documentos en PDF o Word">
              Sube la demanda en la pestaña <Link className="link" href={`/expedientes/${matterId}?tab=documentos`}>Documentos</Link> y vuelve aquí, o pega su texto abajo.
            </EmptyState>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">O pegar el texto de la demanda (por ejemplo, si es un escaneo)</summary>
            <textarea className="input mt-2 min-h-48 font-mono text-xs" name="text" placeholder="Pega aquí el texto completo de la demanda. Si pegas texto, se usa en lugar del documento." />
          </details>
          <SubmitButton pendingText="Leyendo la demanda…">Analizar la demanda</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
