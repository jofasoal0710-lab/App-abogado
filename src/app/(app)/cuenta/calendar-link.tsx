"use client";

import { useActionState, useState } from "react";
import { createCalendarLinkAction, type CalendarLinkState } from "./calendar-actions";

/** Genera el enlace de suscripción y lo muestra una única vez, con botón para copiarlo. */
export function CalendarLinkCreator({ hasLink }: { hasLink: boolean }) {
  const [state, action, pending] = useActionState<CalendarLinkState, FormData>(createCalendarLinkAction, undefined);
  const [copied, setCopied] = useState(false);
  if (state?.url) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
        <p className="font-medium">Tu enlace privado de calendario</p>
        <p className="mt-1">Cópialo ahora: por seguridad no se volverá a mostrar. Quien lo tenga puede ver tu agenda, así que no lo compartas.</p>
        <input className="input mt-2 font-mono text-xs" readOnly value={state.url} aria-label="Enlace del calendario" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-primary btn-sm mt-2"
          onClick={() => {
            navigator.clipboard?.writeText(state.url!);
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
    );
  }
  return (
    <form action={action}>
      <button className={hasLink ? "btn-secondary" : "btn-primary"} disabled={pending}>
        {pending ? "Creando…" : hasLink ? "Crear un enlace nuevo (el anterior deja de funcionar)" : "Crear mi enlace de calendario"}
      </button>
    </form>
  );
}
