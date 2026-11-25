"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { markTourSeenAction } from "@/app/(app)/ayuda/actions";
import { getTour, type Tour, type TourStep } from "@/lib/help/guides";

export const START_TOUR_EVENT = "bufete:tour";
/** Lanza un recorrido desde cualquier parte de la app. */
export function startTour(key: string) {
  window.dispatchEvent(new CustomEvent(START_TOUR_EVENT, { detail: key }));
}

/** Primer elemento visible que encaje con el selector del paso (o null si no hay ninguno). */
function findTarget(selector: string | null): HTMLElement | null {
  if (!selector) return null;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/**
 * Recorridos guiados: oscurece la pantalla, resalta el elemento de cada paso y explica para qué sirve. Se
 * salta los pasos cuyo elemento no está (por permisos o por el tamaño de pantalla). Esc o «Saltar» lo cierran.
 * El de bienvenida se abre solo la primera vez que alguien entra en el panel.
 */
export function TourRunner({ autoStart }: { autoStart: string | null }) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  const open = useCallback((key: string) => {
    const t = getTour(key);
    if (!t) return;
    // Solo los pasos cuyo elemento existe en esta pantalla (los generales, sin elemento, siempre).
    const available = t.steps.filter((s) => !s.target || findTarget(s.target));
    if (!available.length) return;
    setTour(t);
    setSteps(available);
    setI(0);
  }, []);

  const close = useCallback(() => {
    if (tour) void markTourSeenAction(tour.key);
    setTour(null);
    setRect(null);
  }, [tour]);

  // Desde un botón («Ver recorrido»), desde /ayuda (?tour=…) o automáticamente la primera vez.
  useEffect(() => {
    const onStart = (e: Event) => open((e as CustomEvent<string>).detail);
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [open]);
  // «?tour=…» en la dirección (enlaces del centro de ayuda): se abre una vez y se limpia la dirección.
  const requested = search.get("tour");
  useEffect(() => {
    if (!requested) return;
    router.replace(pathname, { scroll: false });
    setTimeout(() => open(requested), 500);
  }, [requested, pathname, open, router]);
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoDone.current || requested || !autoStart || pathname !== getTour(autoStart)?.path) return;
    autoDone.current = true;
    const t = setTimeout(() => open(autoStart), 800);
    return () => clearTimeout(t);
  }, [requested, pathname, autoStart, open]);

  const step = tour ? steps[i] : null;
  // Resalta el elemento del paso (lo trae a la vista) y sigue su posición si la página se mueve.
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(update, 350);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);
  useEffect(() => {
    if (!tour) return;
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, steps.length, close]);

  if (!tour || !step) return null;
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const boxW = Math.min(360, vw - 24);
  // La explicación va debajo del elemento si cabe; si no, encima; sin elemento, en el centro.
  let style: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + pad + 12;
    const top = below + 220 < vh ? below : Math.max(12, rect.top - pad - 12 - 220);
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - boxW / 2), vw - boxW - 12);
    style = { top, left, width: boxW };
  } else style = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: boxW };
  const last = i === steps.length - 1;

  return (
    <div className="no-print fixed inset-0 z-[60]" data-tour-overlay>
      {/* Fondo oscuro con un «hueco» sobre el elemento resaltado. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-4 ring-brand-400 transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink-900/55" />
      )}
      <div
        ref={boxRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed rounded-2xl border border-ink-200 bg-surface p-4 shadow-2xl outline-none"
        style={style}
      >
        <p className="text-xs font-medium text-brand-700">
          {tour.title} · {i + 1} de {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 font-serif text-lg font-semibold text-ink-900">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{step.text}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={close}>
            Saltar
          </button>
          <span className="flex-1" />
          {i > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setI(i - 1)}>
              Anterior
            </button>
          )}
          <button type="button" className="btn-primary btn-sm" onClick={() => (last ? close() : setI(i + 1))} autoFocus>
            {last ? "Terminar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
