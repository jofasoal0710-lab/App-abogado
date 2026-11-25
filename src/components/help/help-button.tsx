"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { guideFor } from "@/lib/help/guides";
import { startTour } from "./tour-runner";

/**
 * Botón «?» junto al título de cada pantalla: abre a la derecha la guía de esa pantalla (para qué sirve,
 * cómo se hace cada cosa, trucos y preguntas frecuentes) y, si la hay, su recorrido guiado.
 */
export function HelpButton({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  if (!guide) return null;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        data-tour="ayuda"
        aria-label={`Ayuda: ${guide.title}`}
        title="Ayuda de esta pantalla"
        className={`no-print inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-surface text-sm font-semibold text-brand-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${className}`}
      >
        ?
      </button>
      {open && (
        <div className="no-print fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <button type="button" className="absolute inset-0 bg-ink-900/40" aria-label="Cerrar la ayuda" onClick={() => setOpen(false)} />
          <div ref={panelRef} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl outline-none">
            <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Ayuda</p>
                <h2 id="help-title" className="font-serif text-xl font-semibold text-ink-900">
                  {guide.title}
                </h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Cerrar la ayuda">
                ✕
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm text-ink-800">
              <p className="leading-relaxed">{guide.summary}</p>
              {guide.tour && (
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => startTour(guide.tour!), 150);
                  }}
                >
                  ▶ Ver el recorrido guiado
                </button>
              )}
              <section aria-labelledby="help-howto">
                <h3 id="help-howto" className="mb-2 font-semibold text-ink-900">
                  Cómo se hace
                </h3>
                <div className="space-y-2">
                  {guide.howTo.map((h, k) => (
                    <details key={h.title} open={k === 0} className="rounded-lg border border-ink-200 px-3 py-2 open:bg-ink-50">
                      <summary className="cursor-pointer font-medium text-ink-900">{h.title}</summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-700">
                        {h.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>
              </section>
              {guide.tips?.length ? (
                <section aria-labelledby="help-tips">
                  <h3 id="help-tips" className="mb-2 font-semibold text-ink-900">
                    Trucos
                  </h3>
                  <ul className="space-y-1.5">
                    {guide.tips.map((t) => (
                      <li key={t} className="flex gap-2 rounded-lg bg-brand-50 px-3 py-2 text-brand-900">
                        <span aria-hidden>💡</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {guide.faq?.length ? (
                <section aria-labelledby="help-faq">
                  <h3 id="help-faq" className="mb-2 font-semibold text-ink-900">
                    Preguntas frecuentes
                  </h3>
                  <dl className="space-y-3">
                    {guide.faq.map((f) => (
                      <div key={f.q}>
                        <dt className="font-medium text-ink-900">{f.q}</dt>
                        <dd className="mt-0.5 text-ink-700">{f.a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </div>
            <footer className="border-t border-ink-200 px-5 py-3 text-sm">
              <Link href="/ayuda" className="link" onClick={() => setOpen(false)}>
                Abrir el centro de ayuda →
              </Link>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
