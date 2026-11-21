"use client";

import { useEffect, useState } from "react";

/**
 * Barra fija de «Seleccionar varios»: cuenta los artículos marcados (casillas del formulario `formId`)
 * y envía la selección a la pantalla de citar en un expediente.
 */
export function SelectionBar({ formId, cancelHref, storageKey }: { formId: string; cancelHref: string; /** Para recordar lo marcado al cambiar de capítulo o de búsqueda. */ storageKey: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const read = (): Set<string> => {
      try {
        return new Set(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
      } catch {
        return new Set();
      }
    };
    const write = (set: Set<string>) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...set]));
      } catch {
        /* sin almacenamiento: vale solo para esta página */
      }
      setSelected([...set]);
    };
    const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="sel"]`)];
    const set = read();
    for (const b of boxes()) b.checked = set.has(b.value);
    setSelected([...set]);
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.name !== "sel" || t.getAttribute("form") !== formId) return;
      const cur = read();
      if (t.checked) cur.add(t.value);
      else cur.delete(t.value);
      write(cur);
    };
    // Al enviar, se añaden los marcados en otras páginas de la ley.
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const onSubmit = () => {
      const onPage = new Set(boxes().filter((b) => b.checked).map((b) => b.value));
      for (const v of read()) {
        if (onPage.has(v)) continue;
        const h = document.createElement("input");
        h.type = "hidden";
        h.name = "sel";
        h.value = v;
        form?.appendChild(h);
      }
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* nada */
      }
    };
    document.addEventListener("change", onChange);
    form?.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("change", onChange);
      form?.removeEventListener("submit", onSubmit);
    };
  }, [formId, storageKey]);
  const count = selected.length;
  const clear = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* nada */
    }
  };
  return (
    <div className="no-print sticky bottom-24 z-20 mt-4 flex sm:bottom-4 sm:mr-44 flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-surface px-4 py-3 shadow-lg" role="region" aria-label="Artículos seleccionados">
      <p className="text-sm text-ink-700" aria-live="polite">
        {count === 0 ? "Marca los artículos que quieres añadir al expediente (puedes cambiar de capítulo o buscar: se recuerdan)." : `${count} ${count === 1 ? "artículo seleccionado" : "artículos seleccionados"}: ${[...selected].slice(0, 8).join(", ")}${count > 8 ? "…" : ""}`}
      </p>
      <div className="flex gap-2">
        <a className="btn-secondary btn-sm" href={cancelHref} onClick={clear}>
          Cancelar selección
        </a>
        <button type="submit" form={formId} className="btn-primary btn-sm" disabled={count === 0}>
          Añadir al expediente
        </button>
      </div>
    </div>
  );
}

/** Casilla de un artículo (va asociada al formulario de la selección aunque esté fuera de él). */
export function SelectBox({ formId, number, label }: { formId: string; number: string; label: string }) {
  return (
    <label className="no-print inline-flex cursor-pointer items-center gap-2 rounded-md px-1 text-sm text-ink-700">
      <input type="checkbox" form={formId} name="sel" value={number} className="h-4 w-4" aria-label={`Seleccionar ${label}`} />
      <span className="sr-only">{label}</span>
    </label>
  );
}
