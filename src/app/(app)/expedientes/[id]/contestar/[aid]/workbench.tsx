"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { procedureDeadline } from "@/lib/calculators";
import { EVIDENCE_LABELS, FACT_ANSWERS, PROCESSES, defensesFor, type Answers, type DemandAnalysis, type FactAnswer, type ProcessKind } from "@/lib/demand-analysis";
import type { ActionState } from "@/lib/actions";

type Props = {
  id: number;
  analysis: DemandAnalysis;
  initial: Answers;
  save: (id: number, json: string) => Promise<{ ok: boolean; error?: string; savedAt?: string }>;
  generate: (id: number) => Promise<void>;
  addDeadline: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hasEvent: boolean;
  today: string;
};

const ANSWER_STYLE: Record<FactAnswer, string> = {
  admito: "border-emerald-500 bg-emerald-50 text-emerald-800",
  variantes: "border-amber-500 bg-amber-50 text-amber-900",
  rechazo: "border-red-500 bg-red-50 text-red-800",
  desconozco: "border-ink-500 bg-ink-100 text-ink-800",
};

const fmt = (iso: string) => iso.split("-").reverse().join("/");

/** Mesa de trabajo de la contestación: hecho por hecho, pretensiones, prueba, excepciones. Se guarda sola. */
export function Workbench({ id, analysis, initial, save, generate, addDeadline, hasEvent, today }: Props) {
  const [ans, setAns] = useState<Answers>(initial);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(ans);
  latest.current = ans;

  const kind: ProcessKind = ans.process ?? analysis.process;
  const proc = PROCESSES[kind];
  const defenses = useMemo(() => defensesFor(kind), [kind]);
  const done = analysis.facts.filter((f) => ans.facts[String(f.n)]?.a).length;
  const deadline = ans.notifiedOn ? procedureDeadline({ notified: ans.notifiedOn, amount: proc.days, unit: "dias" }) : null;
  const daysLeft = deadline ? Math.round((Date.parse(deadline.due) - Date.parse(today)) / 86_400_000) : null;

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    const r = await save(id, JSON.stringify(latest.current));
    if (r.ok) {
      setStatus("saved");
      setSavedAt(new Date(r.savedAt!).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" }));
    } else setStatus("error");
    return r.ok;
  }, [id, save]);

  const update = (fn: (a: Answers) => Answers) => {
    setAns((prev) => fn(structuredClone(prev)));
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), 1200);
  };
  // Al salir con cambios sin guardar, se avisa.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "pending" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const setFact = (n: number, patch: { a?: FactAnswer; why?: string }) => update((a) => ({ ...a, facts: { ...a.facts, [n]: { ...a.facts[n], ...patch } } }));

  return (
    <div className="space-y-6">
      {/* Barra de avance, siempre visible al bajar. */}
      <div className="card sticky top-2 z-20 px-4 py-2 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-40 flex-1">
            <div className="flex justify-between text-xs font-medium text-ink-600">
              <span>
                {done} de {analysis.facts.length} hechos respondidos
              </span>
              <span aria-live="polite">{status === "saving" ? "Guardando…" : status === "pending" ? "Cambios sin guardar" : status === "error" ? "No se pudo guardar" : savedAt ? `Guardado ${savedAt}` : ""}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuemin={0} aria-valuemax={analysis.facts.length} aria-valuenow={done} aria-label="Hechos respondidos">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${analysis.facts.length ? (done / analysis.facts.length) * 100 : 0}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={generating}
            onClick={async () => {
              setGenerating(true);
              if (await saveNow()) await generate(id);
              setGenerating(false);
            }}
          >
            {generating ? "Redactando…" : "Redactar la contestación"}
          </button>
        </div>
      </div>

      <section className="card card-pad" aria-labelledby="plazo">
        <h2 id="plazo" className="font-semibold">Tipo de proceso y plazo para contestar</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Tipo de proceso</span>
            <select className="input" value={kind} onChange={(e) => update((a) => ({ ...a, process: e.target.value as ProcessKind }))}>
              {(Object.keys(PROCESSES) as ProcessKind[]).map((k) => (
                <option key={k} value={k}>
                  {PROCESSES[k].label}
                </option>
              ))}
            </select>
            <span className="hint block">Detectado por: «{analysis.processWhy}». Cámbialo si no es correcto.</span>
          </label>
          <label className="block">
            <span className="label">Fecha de notificación de la demanda</span>
            <input className="input" type="date" value={ans.notifiedOn} max={today} onChange={(e) => update((a) => ({ ...a, notifiedOn: e.target.value }))} />
          </label>
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            {deadline ? (
              <>
                <p className="text-ink-600">Vence el</p>
                <p className={`text-lg font-semibold ${daysLeft !== null && daysLeft <= 3 ? "text-red-700" : "text-ink-900"}`}>{fmt(deadline.due)}</p>
                <p className="text-xs text-ink-500">{daysLeft !== null && (daysLeft < 0 ? "Plazo vencido" : daysLeft === 0 ? "Vence hoy" : `Faltan ${daysLeft} día${daysLeft === 1 ? "" : "s"} naturales`)} · {proc.days} días hábiles ({proc.ref})</p>
              </>
            ) : (
              <p className="text-ink-600">Indica la fecha de notificación para calcular el vencimiento ({proc.days} días hábiles, {proc.ref}).</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-700">{proc.rule}</p>
        {ans.notifiedOn && (
          <ActionForm action={addDeadline} className="mt-3">
            <input type="hidden" name="notifiedOn" value={ans.notifiedOn} />
            <SubmitButton className="btn-secondary btn-sm" pendingText="Añadiendo…">
              {hasEvent ? "Actualizar el plazo en el Control de plazos" : "Añadir el plazo al Control de plazos"}
            </SubmitButton>
          </ActionForm>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="hechos">
        <div>
          <h2 id="hechos" className="font-serif text-xl font-semibold">1. Los hechos</h2>
          <p className="text-sm text-ink-600">Responde cada hecho en el mismo orden de la demanda. Explica tus razones: en la contestación deben ir «de forma razonada».</p>
        </div>
        {analysis.facts.length === 0 && <p className="card card-pad text-sm text-ink-600">No se encontraron hechos numerados. Revisa el texto original al final de la página.</p>}
        {analysis.facts.map((f) => {
          const cur = ans.facts[String(f.n)] ?? {};
          return (
            <article key={f.n} className={`card card-pad ${cur.a ? "" : "border-amber-200"}`} aria-labelledby={`h${f.n}`}>
              <h3 id={`h${f.n}`} className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                Hecho {f.n}
              </h3>
              <blockquote className="mt-1 border-l-4 border-ink-200 pl-3 text-sm leading-relaxed text-ink-800">{f.text}</blockquote>
              <fieldset className="mt-3">
                <legend className="sr-only">Respuesta al hecho {f.n}</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FACT_ANSWERS) as FactAnswer[]).map((k) => (
                    <label key={k} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium ${cur.a === k ? ANSWER_STYLE[k] : "border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
                      <input type="radio" name={`fact-${f.n}`} value={k} checked={cur.a === k} onChange={() => setFact(f.n, { a: k })} className="sr-only" />
                      {FACT_ANSWERS[k]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {cur.a && (
                <label className="mt-2 block">
                  <span className="sr-only">Razones del hecho {f.n}</span>
                  <textarea
                    className="input min-h-16"
                    value={cur.why ?? ""}
                    onChange={(e) => setFact(f.n, { why: e.target.value })}
                    placeholder={cur.a === "admito" ? "Opcional: una precisión." : cur.a === "variantes" ? "¿Qué parte es cierta y qué se rectifica?" : cur.a === "rechazo" ? "¿Por qué es inexacto? ¿Qué ocurrió en realidad y con qué prueba?" : "¿Por qué tu cliente no puede saberlo?"}
                  />
                </label>
              )}
            </article>
          );
        })}
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="pretensiones">
        <h2 id="pretensiones" className="font-serif text-xl font-semibold">2. Las pretensiones</h2>
        <p className="text-sm text-ink-600">Por defecto, te opones a todas. Marca «Me allano» solo si tu cliente acepta lo que se pide.</p>
        {analysis.claims.length === 0 && <p className="text-sm text-ink-600">No se encontraron pretensiones numeradas.</p>}
        {analysis.claims.map((c) => {
          const cur = ans.claims[String(c.n)] ?? {};
          return (
            <div key={c.n} className="rounded-lg border border-ink-200 p-3">
              <p className="text-sm text-ink-800">
                <span className="font-semibold">{c.n}.</span> {c.text}
              </p>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!cur.allanamiento} onChange={(e) => update((a) => ({ ...a, claims: { ...a.claims, [c.n]: { ...a.claims[c.n], allanamiento: e.target.checked } } }))} className="h-4 w-4" />
                  Me allano
                </label>
                <textarea className="input min-h-12 flex-1" value={cur.why ?? ""} onChange={(e) => update((a) => ({ ...a, claims: { ...a.claims, [c.n]: { ...a.claims[c.n], why: e.target.value } } }))} placeholder={cur.allanamiento ? "Condiciones del allanamiento (opcional)" : "Motivo de la oposición"} />
              </div>
            </div>
          );
        })}
        <label className="block">
          <span className="label">
            Posición sobre la estimación {analysis.estimate ? `(la demanda la fija en ${analysis.estimate.text})` : ""}
          </span>
          <textarea className="input min-h-12" value={ans.estimatePosition} onChange={(e) => update((a) => ({ ...a, estimatePosition: e.target.value }))} placeholder="Por ejemplo: se rechaza por excesiva, al no corresponder a los extremos reclamados." />
        </label>
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="excepciones">
        <h2 id="excepciones" className="font-serif text-xl font-semibold">3. Excepciones</h2>
        <p className="text-sm text-ink-600">Se oponen con la contestación y razonadas. {kind === "ordinario_civil" || kind === "sumario_civil" || kind === "monitorio" ? "Como excepciones procesales solo se admiten las cinco del art. 37.3 CPC." : ""}</p>
        {(["procesal", "material"] as const).map((group) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-ink-700">{group === "procesal" ? "Procesales" : "De fondo"}</h3>
            {defenses.filter((d) => d.kind === group).length === 0 && <p className="text-sm text-ink-500">—</p>}
            <ul className="mt-1 space-y-2">
              {defenses
                .filter((d) => d.kind === group)
                .map((d) => {
                  const cur = ans.defenses[d.key] ?? {};
                  return (
                    <li key={d.key} className="rounded-lg border border-ink-200 p-2.5">
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!cur.on} onChange={(e) => update((a) => ({ ...a, defenses: { ...a.defenses, [d.key]: { ...a.defenses[d.key], on: e.target.checked } } }))} />
                        <span>
                          <span className="font-medium">{d.label}</span>
                          {d.ref && <span className="ml-1 text-xs text-ink-500">({d.ref})</span>}
                          <span className="block text-xs text-ink-500">{d.hint}</span>
                        </span>
                      </label>
                      {cur.on && <textarea className="input mt-2 min-h-14" value={cur.why ?? ""} onChange={(e) => update((a) => ({ ...a, defenses: { ...a.defenses, [d.key]: { ...a.defenses[d.key], why: e.target.value } } }))} placeholder="Razona la excepción: hechos en que se funda y prueba." />}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="prueba-actor">
        <h2 id="prueba-actor" className="font-serif text-xl font-semibold">4. La prueba de la parte actora</h2>
        {analysis.evidence.length === 0 && <p className="text-sm text-ink-600">No se encontró la sección de prueba.</p>}
        {analysis.evidence.map((e) => (
          <div key={e.n} className="rounded-lg border border-ink-200 p-3">
            <p className="text-sm text-ink-800">
              <span className="badge-gray mr-1">{EVIDENCE_LABELS[e.kind]}</span> {e.text}
            </p>
            <textarea className="input mt-2 min-h-12" value={ans.evidence[String(e.n)]?.objection ?? ""} onChange={(ev) => update((a) => ({ ...a, evidence: { ...a.evidence, [e.n]: { objection: ev.target.value } } }))} placeholder="Opcional: objeción (impertinente, innecesaria, copia sin certificar…)" />
          </div>
        ))}
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="mi-prueba">
        <h2 id="mi-prueba" className="font-serif text-xl font-semibold">5. Tu prueba y el derecho</h2>
        <label className="block">
          <span className="label">Prueba que ofreces (una por línea)</span>
          <textarea className="input min-h-28" value={ans.ownEvidence} onChange={(e) => update((a) => ({ ...a, ownEvidence: e.target.value }))} placeholder={"Documental: carta de renuncia del 14 de agosto de 2025.\nTestimonial: Pedro Rojas, administrador del local."} />
        </label>
        <label className="block">
          <span className="label">Fundamentos de derecho</span>
          <textarea className="input min-h-24" value={ans.legalGrounds} onChange={(e) => update((a) => ({ ...a, legalGrounds: e.target.value }))} placeholder="Si lo dejas vacío, se usan las normas citadas en el expediente (pestaña Normativa)." />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={generating}
          onClick={async () => {
            setGenerating(true);
            if (await saveNow()) await generate(id);
            setGenerating(false);
          }}
        >
          {generating ? "Redactando…" : "Redactar la contestación"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => void saveNow()}>
          Guardar
        </button>
        <span className="text-sm text-ink-500">Lo que quede sin responder sale marcado como [PENDIENTE] en el escrito. Luego puedes corregirlo, revisar la ortografía, imprimirlo o descargarlo en Word.</span>
      </div>
      <p className="text-xs text-ink-500">
        ¿Necesitas calcular algo? <Link className="link" href="/herramientas">Herramientas</Link> (liquidación laboral, prescripción, plazos).
      </p>
    </div>
  );
}
