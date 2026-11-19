"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/actions";
import { deleteTimeEntriesAction } from "./actions";

export const BULK_FORM_ID = "horas-seleccion";

/**
 * Barra para borrar de una vez las entradas marcadas en la tabla (las casillas apuntan a este
 * formulario con el atributo `form`, así la tabla no tiene formularios anidados).
 */
export function BulkDeleteBar({ selectable }: { selectable: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteTimeEntriesAction, {});
  const [count, setCount] = useState(0);

  useEffect(() => {
    const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${BULK_FORM_ID}"]`)];
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [state]);

  if (selectable === 0) return null;

  function toggleAll(checked: boolean) {
    for (const b of document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${BULK_FORM_ID}"]`)) b.checked = checked;
    setCount(checked ? selectable : 0);
  }

  return (
    <form
      id={BULK_FORM_ID}
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Borrar ${count} ${count === 1 ? "entrada" : "entradas"} de horas? No se puede deshacer.`)) e.preventDefault();
      }}
      className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5 text-sm"
    >
      <span className="flex flex-wrap items-center gap-3 text-ink-600">
        <button type="button" className="btn-ghost btn-sm" onClick={() => toggleAll(count < selectable)}>
          {count < selectable ? "Marcar todas" : "Desmarcar todas"}
        </button>
        <span aria-live="polite">{count ? `${count} marcada${count === 1 ? "" : "s"}` : "Marca las entradas que sobran para borrarlas juntas."}</span>
      </span>
      <span className="flex items-center gap-3">
        {state?.error && (
          <span role="alert" className="text-red-700">
            {state?.error}
          </span>
        )}
        {state?.ok && (
          <span role="status" className="text-emerald-700">
            {state?.ok}
          </span>
        )}
        <button type="submit" className="btn-danger btn-sm" disabled={count === 0 || pending}>
          {pending ? "Borrando…" : `Borrar marcadas${count ? ` (${count})` : ""}`}
        </button>
      </span>
    </form>
  );
}
