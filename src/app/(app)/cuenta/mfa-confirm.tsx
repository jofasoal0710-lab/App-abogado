"use client";

import { useActionState } from "react";
import { confirmMfaAction, type ConfirmState } from "./mfa-actions";

/** Confirma el primer código y, si es correcto, muestra UNA vez los códigos de recuperación. */
export function MfaConfirm() {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmMfaAction, undefined);
  if (state?.codes) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
        <p className="font-medium">Verificación en dos pasos activada.</p>
        <p className="mt-1">Guarda estos códigos de recuperación en un lugar seguro (no en el móvil). Cada uno sirve una sola vez si pierdes el móvil. No se volverán a mostrar.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-base sm:grid-cols-4" aria-label="Códigos de recuperación">
          {state.codes.map((c) => (
            <li key={c} className="rounded bg-white px-2 py-1 text-center ring-1 ring-emerald-200">{c}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(state.codes!.join("\n"))}>Copiar</button>
          <button type="button" className="btn-primary btn-sm" onClick={() => window.location.reload()}>Ya los guardé</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink-800">Código</span>
        <input className="input w-36 text-center font-mono tracking-widest" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
      </label>
      <button className="btn-primary" disabled={pending}>{pending ? "Comprobando…" : "Activar"}</button>
      {state?.error && <p className="w-full text-sm text-red-700" role="alert">{state.error}</p>}
    </form>
  );
}
