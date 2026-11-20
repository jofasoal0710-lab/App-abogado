"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LegalDocument } from "@/components/legal-document";
import type { Block } from "@/lib/forms/engine";
import type { FieldIssues } from "@/lib/spellcheck";
import { ISSUE_LABELS } from "@/lib/text-rules";
import { lawPickerSearchAction, type PickerResult } from "./tools-actions";

/**
 * Buscador de artículos para el «Fundamento de derecho»: «29 código de trabajo», «preaviso»…
 * Añade la cita (y, si se quiere, el texto del artículo) al final del campo.
 */
export function ArticlePicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerResult[] | null>(null);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (q.trim().length < 2) return setResults(null);
      start(async () => setResults(await lawPickerSearchAction(q)));
    }, 350);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open)
    return (
      <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setOpen(true)}>
        + Añadir artículo de ley
      </button>
    );
  const insert = (r: PickerResult, withText: boolean) => {
    onInsert(withText && r.text ? `${r.citation} Dice así: «${r.text.replace(/\s*\n+\s*/g, " ").trim()}»` : r.citation);
    setAdded(r.key);
    setTimeout(() => setAdded(null), 2000);
  };
  return (
    <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
      <div className="flex gap-2">
        <input
          className="input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="«29 código de trabajo», «preaviso», «código notarial»…"
          aria-label="Buscar artículo de ley"
        />
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>
      {pending && <p className="mt-2 text-xs text-ink-500">Buscando…</p>}
      {results && results.length === 0 && !pending && <p className="mt-2 text-xs text-ink-500">Sin resultados. Prueba con el número y la ley: «28 trabajo».</p>}
      {results && results.length > 0 && (
        <ul className="mt-2 max-h-80 divide-y divide-brand-100 overflow-y-auto rounded-md bg-surface">
          {results.map((r) => (
            <li key={r.key} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-ink-900">{r.label}</p>
                <div className="flex gap-1">
                  <button type="button" className="btn-primary btn-sm" onClick={() => insert(r, false)}>
                    {added === r.key ? "Añadido" : "Añadir cita"}
                  </button>
                  {r.text && (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => insert(r, true)}>
                      Cita + texto
                    </button>
                  )}
                </div>
              </div>
              {r.snippet && <p className="mt-1 line-clamp-3 text-xs text-ink-600">{r.snippet.replace(/\[\[|\]\]/g, "")}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Vista previa del documento con lo escrito hasta ahora (sin guardar nada). */
export function PreviewDialog({ blocks, onClose }: { blocks: Block[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Vista previa" className="m-auto max-h-[92vh] w-[min(56rem,96vw)] rounded-xl p-0 backdrop:bg-ink-900/50">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-surface px-5 py-3">
        <p className="font-serif text-lg font-semibold">Vista previa</p>
        <button type="button" className="btn-secondary btn-sm" onClick={() => ref.current?.close()}>
          Cerrar
        </button>
      </div>
      <div className="bg-ink-100 p-3 sm:p-6">
        <div className="mx-auto shadow-sm">
          <LegalDocument blocks={blocks} />
        </div>
      </div>
    </dialog>
  );
}

/** Resultado de la revisión de ortografía y estilo, con «Corregir» para las sugerencias. */
export function SpellingPanel({ results, onFix, onClose }: { results: FieldIssues[]; onFix: (field: string, word: string, replacement: string) => void; onClose: () => void }) {
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const total = results.reduce((s, r) => s + r.issues.length, 0);
  return (
    <section aria-live="polite" className={`rounded-lg border p-4 ${total ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium text-ink-900">{total ? `Revisión: ${total} ${total === 1 ? "observación" : "observaciones"}` : "Revisión: no encontré errores de ortografía ni de puntuación."}</h2>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {results.map((r) => (
        <div key={r.field} className="mt-3">
          <p className="text-sm font-semibold text-ink-800">{r.label}</p>
          <ul className="mt-1 space-y-1.5">
            {r.issues.map((i, n) => {
              const id = `${r.field}-${i.index}-${n}`;
              return (
                <li key={id} className="rounded-md bg-surface px-3 py-2 text-sm">
                  <span className="mr-2 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{ISSUE_LABELS[i.kind]}</span>
                  {i.message}
                  <span className="mt-0.5 block text-xs text-ink-500">{i.excerpt}</span>
                  {i.word && i.suggestions && i.suggestions.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {fixed.has(id) ? (
                        <span className="text-xs text-emerald-700">Corregido</span>
                      ) : (
                        i.suggestions.slice(0, 3).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              onFix(r.field, i.word!, s);
                              setFixed(new Set(fixed).add(id));
                            }}
                          >
                            {i.kind === "ortografia" ? `Cambiar por «${s}»` : "Corregir"}
                          </button>
                        ))
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {total > 0 && <p className="mt-3 text-xs text-ink-500">Revisión automática de ortografía y puntuación (diccionario de español en el servidor; el texto no sale de la app). No sustituye una lectura atenta.</p>}
    </section>
  );
}
