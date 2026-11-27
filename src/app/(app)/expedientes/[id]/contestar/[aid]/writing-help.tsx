"use client";

import { useEffect, useMemo, useState } from "react";
import { ISSUE_LABELS, type TextIssue } from "@/lib/text-rules";
import { pendingPositions, phraseGroups } from "@/lib/writing-phrases";

export type HelpField = { id: string; label: string; text: string };
type FieldIssues = { field: string; label: string; issues: TextIssue[] };

type Props = {
  open: boolean;
  onClose: () => void;
  fields: HelpField[];
  /** Campo donde está el cursor (el último que tuvo el foco). */
  target: { id: string; label: string } | null;
  female: boolean;
  onInsert: (text: string) => void;
  onGo: (fieldId: string, index: number, length: number) => void;
  onReplace: (fieldId: string, index: number, from: string, to: string) => void;
  check: (fields: { field: string; label: string; text: string }[]) => Promise<FieldIssues[]>;
};

type Tab = "frases" | "pendientes" | "revisar";

/**
 * Ayuda para escribir: frases jurídicas que se insertan donde está el cursor, la lista de [PENDIENTE] para
 * completarlos uno a uno, y la revisión de ortografía y estilo (diccionario en el servidor de la app).
 */
export function WritingHelp({ open, onClose, fields, target, female, onInsert, onGo, onReplace, check }: Props) {
  const [tab, setTab] = useState<Tab>("frases");
  const [group, setGroup] = useState("hechos");
  const [issues, setIssues] = useState<FieldIssues[] | null>(null);
  const [checking, setChecking] = useState(false);
  const groups = useMemo(() => phraseGroups({ female }), [female]);
  const pending = useMemo(() => fields.flatMap((f) => pendingPositions(f.text).map((p) => ({ ...p, field: f.id, label: f.label }))), [fields]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // El grupo de frases sigue al campo donde se escribe.
  useEffect(() => {
    if (!target) return;
    const g = target.id.startsWith("fact:") ? "hechos" : target.id.startsWith("claim:") || target.id === "estimate" ? "pretensiones" : target.id.startsWith("evidence:") || target.id === "own" ? "prueba" : null;
    if (g) setGroup(g);
  }, [target]);

  if (!open) return null;
  const current = groups.find((g) => g.key === group) ?? groups[0];

  const runCheck = async () => {
    setChecking(true);
    try {
      setIssues(await check(fields.filter((f) => f.text.trim()).map((f) => ({ field: f.id, label: f.label, text: f.text }))));
    } finally {
      setChecking(false);
    }
  };

  return (
    <aside role="dialog" aria-label="Ayuda para escribir" className="drawer-enter fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-ink-200 bg-white shadow-2xl" data-testid="ayuda-escribir">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h2 className="font-semibold">Ayuda para escribir</h2>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar la ayuda para escribir">
          ✕
        </button>
      </div>
      <div className="border-b border-ink-100 px-4 py-2 text-sm">
        {target ? (
          <p>
            Escribiendo en: <strong>{target.label}</strong>
          </p>
        ) : (
          <p className="text-amber-800">Haz clic primero en el cuadro de texto donde quieres escribir (una respuesta, una pretensión…).</p>
        )}
      </div>
      <nav className="flex gap-1 border-b border-ink-100 px-3 pt-2" aria-label="Secciones de la ayuda">
        {(
          [
            ["frases", "Frases"],
            ["pendientes", `Pendientes (${pending.length})`],
            ["revisar", "Revisar"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === "frases" && (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button key={g.key} type="button" onClick={() => setGroup(g.key)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${g.key === current.key ? "border-brand-500 bg-brand-50 text-brand-800" : "border-ink-200 text-ink-600 hover:bg-ink-50"}`}>
                  {g.title}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {current.phrases.map((p) => (
                <li key={p.label} className="rounded-lg border border-ink-200 p-2.5">
                  <p className="font-medium text-ink-900">{p.label}</p>
                  <p className="mt-0.5 text-ink-600">{p.text}</p>
                  <button type="button" className="btn-secondary btn-sm mt-2" disabled={!target} onClick={() => onInsert(p.text)}>
                    Insertar
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">Se inserta donde está el cursor. Lo que va entre [PENDIENTE] lo completas tú: búscalo en la pestaña «Pendientes».</p>
          </>
        )}

        {tab === "pendientes" && (
          <>
            {pending.length === 0 ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">No queda ningún [PENDIENTE] en tus respuestas.</p>
            ) : (
              <>
                <p className="mb-2 text-ink-600">Pulsa «Ir» para saltar al texto: queda seleccionado y basta con escribir encima.</p>
                <ul className="space-y-2">
                  {pending.map((p, i) => (
                    <li key={`${p.field}-${p.index}-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-900">{p.label}</p>
                        <p className="truncate text-amber-900" title={p.text}>
                          {p.text}
                        </p>
                      </div>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => onGo(p.field, p.index, p.length)}>
                        Ir
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === "revisar" && (
          <>
            <p className="mb-2 text-ink-600">Revisa la ortografía (diccionario español con términos jurídicos) y el estilo de todas tus respuestas. El texto no sale de la app.</p>
            <button type="button" className="btn-primary btn-sm" onClick={() => void runCheck()} disabled={checking}>
              {checking ? "Revisando…" : issues ? "Volver a revisar" : "Revisar ortografía y estilo"}
            </button>
            {issues && issues.length === 0 && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">No encontré errores.</p>}
            {issues && issues.length > 0 && (
              <ul className="mt-3 space-y-3">
                {issues.map((f) => (
                  <li key={f.field}>
                    <p className="font-semibold text-ink-800">{f.label}</p>
                    <ul className="mt-1 space-y-1.5">
                      {f.issues.map((is, i) => (
                        <li key={i} className="rounded-md border border-ink-200 p-2">
                          <p>
                            <span className="mr-1 rounded bg-ink-100 px-1.5 py-0.5 text-xs">{ISSUE_LABELS[is.kind]}</span>
                            {is.message}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">«{is.excerpt}»</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {is.word &&
                              is.suggestions?.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={() => {
                                    onReplace(f.field, is.index, is.word!, s);
                                    setIssues((prev) => prev?.map((x) => (x.field === f.field ? { ...x, issues: x.issues.filter((y) => y !== is) } : x)).filter((x) => x.issues.length) ?? null);
                                  }}
                                >
                                  Cambiar por «{s}»
                                </button>
                              ))}
                            <button type="button" className="btn-ghost btn-sm" onClick={() => onGo(f.field, is.index, is.word?.length ?? 0)}>
                              Ir
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
