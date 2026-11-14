"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Guardando…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Formulario ligado a una Server Action que devuelve { error } / { ok }.
 * `resetOnSuccess` limpia los campos cuando la acción responde con { ok }.
 *
 * Se envía el FormData manualmente en lugar de usar `<form action>`: React 19 vacía los
 * campos de un formulario tras ejecutar su acción, y aquí no queremos que el usuario
 * pierda lo que escribió cuando el servidor devuelve un error de validación.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {children}
        {state?.error && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.ok}
          </p>
        )}
      </form>
    </PendingContext.Provider>
  );
}

/** Botón de formulario que pide confirmación antes de enviar (acciones destructivas). */
export function ConfirmButton({
  children,
  message,
  className = "btn-danger btn-sm",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary no-print" onClick={() => window.print()}>
      Imprimir / PDF
    </button>
  );
}
