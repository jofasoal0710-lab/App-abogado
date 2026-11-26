import type { Metadata } from "next";
import { HelpButton } from "@/components/help/help-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/form";
import { Breadcrumbs } from "@/components/ui";
import { db } from "@/db";
import { clients, demandAnalyses } from "@/db/schema";
import { requireMatterPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { EVIDENCE_LABELS, PROCESSES, observations, sanitizeAnswers, type DemandAnalysis } from "@/lib/demand-analysis";
import { checkCitations } from "@/lib/demand-db";
import { pointByPoint } from "@/lib/demand-points";
import { addAnswerDeadlineAction, deleteDemandAnalysisAction, fillMatterFromDemandAction, generateAnswerWritingAction, reanalyzeDemandAction, saveDemandAnswersAction } from "../../../contestar-actions";
import { Workbench } from "./workbench";

export const metadata: Metadata = { title: "Contestar la demanda" };

const LEVEL = { alerta: "border-red-200 bg-red-50 text-red-800", aviso: "border-amber-200 bg-amber-50 text-amber-900", info: "border-brand-100 bg-brand-50 text-brand-900" } as const;
const LEVEL_ICON = { alerta: "⚠", aviso: "!", info: "ℹ" } as const;

/** Mesa de trabajo: lo que la app entendió de la demanda y la preparación de la contestación. */
export default async function AnswerDemandPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const user = await requireUser();
  const p = await params;
  const matterId = Number(p.id);
  const aid = Number(p.aid);
  if (!Number.isInteger(matterId) || !Number.isInteger(aid)) notFound();
  const matter = await requireMatterPage(user, matterId);
  const [row] = await db.select().from(demandAnalyses).where(and(eq(demandAnalyses.id, aid), eq(demandAnalyses.matterId, matterId)));
  if (!row) notFound();
  const analysis = row.analysis as DemandAnalysis;
  const answers = sanitizeAnswers(row.answers, analysis);
  const [[client], citations] = await Promise.all([db.select({ name: clients.name }).from(clients).where(eq(clients.id, matter.clientId)), checkCitations(analysis.citations)]);
  const today = todayISO();
  const obs = observations({ ...analysis, process: answers.process ?? analysis.process }, { clientName: client?.name, today, missingArticles: citations.filter((c) => c.loaded && c.missing.length).map((c) => ({ law: c.law, articles: c.missing })) });
  const points = pointByPoint(analysis, { text: row.text, clientName: client?.name, today });
  const canFill = (!matter.court && analysis.court) || (!matter.courtCaseNumber && analysis.caseNumber) || (!matter.opposingParty && analysis.plaintiffs.length);
  const evidenceCount = Object.entries(
    analysis.evidence.reduce<Record<string, number>>((acc, e) => ((acc[EVIDENCE_LABELS[e.kind]] = (acc[EVIDENCE_LABELS[e.kind]] ?? 0) + 1), acc), {}),
  )
    .map(([k, n]) => `${n} ${k.toLowerCase()}`)
    .join(", ");
  const fact = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink-900">{value || <span className="text-ink-400">No detectado</span>}</dd>
    </div>
  );

  return (
    <>
      <Breadcrumbs items={[{ label: "Expedientes", href: "/expedientes" }, { label: matter.number, href: `/expedientes/${matterId}?tab=escritos` }, { label: "Contestar", href: `/expedientes/${matterId}/contestar` }, { label: row.sourceName }]} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2" data-tour="titulo">
            <h1 className="font-serif text-2xl font-semibold">Contestar la demanda</h1>
            <HelpButton />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {row.sourceName} · {analysis.words.toLocaleString("es-CR")} palabras · tu cliente: <strong>{client?.name}</strong> (parte demandada)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.writingId && (
            <Link href={`/escritos/${row.writingId}`} className="btn-secondary">
              Ver la contestación redactada
            </Link>
          )}
          <form action={reanalyzeDemandAction.bind(null, aid)}>
            <button className="btn-ghost" title="Vuelve a leer el documento con la última versión del analizador. Tus respuestas se conservan.">
              Volver a leer la demanda
            </button>
          </form>
          <form action={deleteDemandAnalysisAction.bind(null, aid)}>
            <ConfirmButton message="¿Borrar este análisis y tus respuestas? (El escrito ya redactado y el documento no se borran.)" className="btn-ghost">
              Borrar análisis
            </ConfirmButton>
          </form>
        </div>
      </div>

      <section className="card card-pad mb-6" aria-labelledby="entendido">
        <h2 id="entendido" className="font-semibold">Lo que entendí de la demanda</h2>
        <p className="mt-1 text-sm text-ink-700">
          {PROCESSES[answers.process ?? analysis.process].label}
          {analysis.plaintiffs.length ? <> de <strong>{analysis.plaintiffs.join(" y ")}</strong></> : ""}
          {analysis.defendants.length ? <> contra <strong>{analysis.defendants.join(" y ")}</strong></> : ""}
          {analysis.court ? <> ante {analysis.court}</> : ""}. Narra <strong>{analysis.facts.length} hechos</strong>
          {analysis.dates.length > 1 ? <> (entre el {analysis.dates[0].split("-").reverse().join("/")} y el {analysis.dates.at(-1)!.split("-").reverse().join("/")})</> : ""}, pide <strong>{analysis.claims.length} pretensiones</strong>
          {analysis.estimate ? <>, estima la demanda en <strong>{analysis.estimate.text}</strong></> : ""} y ofrece <strong>{analysis.evidence.length} pruebas</strong>
          {evidenceCount ? ` (${evidenceCount})` : ""}.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fact("Parte actora", analysis.plaintiffs.join("; "))}
          {fact("Parte demandada", analysis.defendants.join("; "))}
          {fact("Juzgado", analysis.court)}
          {fact("Expediente judicial", analysis.caseNumber)}
        </dl>
        <p className="mt-3 text-xs text-ink-500">Secciones reconocidas: {analysis.sections.length ? analysis.sections.join(", ") : "ninguna"}. La lectura es automática: revisa siempre contra el texto original (al final).</p>
        {canFill && (
          <form action={fillMatterFromDemandAction.bind(null, aid)} className="mt-3">
            <button className="btn-secondary btn-sm">Completar el expediente con estos datos (juzgado, n.º judicial, parte contraria)</button>
          </form>
        )}
      </section>

      {obs.length > 0 && (
        <section className="mb-6" aria-labelledby="obs">
          <h2 id="obs" className="mb-2 font-semibold">Qué vigilar al contestar</h2>
          <ul className="space-y-2">
            {obs.map((o, i) => (
              <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${LEVEL[o.level]}`}>
                <span aria-hidden className="font-bold">{LEVEL_ICON[o.level]}</span>
                <span>
                  {o.text}
                  {o.ref && <span className="ml-1 opacity-75">({o.ref})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Workbench
        id={aid}
        analysis={analysis}
        points={points}
        initial={answers}
        save={saveDemandAnswersAction}
        generate={generateAnswerWritingAction}
        addDeadline={addAnswerDeadlineAction.bind(null, aid)}
        hasEvent={!!row.eventId}
        today={today}
      />

      {citations.length > 0 && (
        <section className="card card-pad mt-6" aria-labelledby="citas">
          <h2 id="citas" className="font-semibold">Normas que cita la demanda</h2>
          <p className="mt-1 text-sm text-ink-600">Comprobadas contra el texto vigente cargado en la app. Ábrelas para ver si dicen lo que la parte actora afirma.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {citations.map((c) => (
              <li key={c.normKey ?? c.law}>
                <span className="font-medium">{c.law}:</span>{" "}
                {c.articles.map((a, i) => (
                  <span key={a}>
                    {i > 0 && ", "}
                    {c.loaded && c.found.includes(a) ? (
                      <Link className="link" href={`/normativa/${c.normKey}?art=${encodeURIComponent(a)}`} target="_blank">
                        art. {a}
                      </Link>
                    ) : (
                      <span className={c.loaded ? "font-semibold text-red-700" : "text-ink-600"} title={c.loaded ? "No existe en el texto cargado" : "Ley no cargada en la app"}>
                        art. {a}
                        {c.loaded ? " (no existe)" : ""}
                      </span>
                    )}
                  </span>
                ))}
                {!c.loaded && <span className="ml-1 text-xs text-ink-500">(esta ley no está cargada en Normativa)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card card-pad mt-6">
        <summary className="cursor-pointer font-semibold">Texto original de la demanda</summary>
        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-800">{row.text}</pre>
      </details>
    </>
  );
}
