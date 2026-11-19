"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";
import type { Field, Values } from "@/lib/forms/engine";

/**
 * Campos de un formulario. Enter NO envía (solo el botón): así no se genera un escrito a medias por
 * error. Los campos van sin texto de ejemplo dentro; las indicaciones van debajo, en pequeño.
 */
export function WritingForm({
  action,
  fields,
  values,
  title,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  values: Values;
  title: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        if (e.key === "Enter" && el.tagName === "INPUT") e.preventDefault();
      }}
      className="space-y-5"
    >
      <div className="card card-pad">
        <label className="block">
          <span className="label">Título del documento</span>
          <input className="input" name="title" defaultValue={title} maxLength={200} />
          <span className="hint block">Para reconocerlo en la lista del expediente.</span>
        </label>
      </div>

      <div className="card card-pad grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const wide = f.type === "textarea" || f.type === "list";
          return (
            <label key={f.name} className={`block ${wide ? "sm:col-span-2" : ""}`}>
              <span className="label">
                {f.label}
                {f.required && <span className="text-red-700"> *</span>}
              </span>
              {wide ? (
                <textarea
                  className={`input ${f.name === "hechos" ? "min-h-72" : "min-h-32"} leading-relaxed`}
                  name={`f_${f.name}`}
                  defaultValue={values[f.name] ?? ""}
                />
              ) : (
                <input className="input" type={f.type === "date" ? "date" : "text"} name={`f_${f.name}`} defaultValue={values[f.name] ?? ""} />
              )}
              {f.hint && <span className="hint block">{f.hint}</span>}
              {f.auto && !f.hint && <span className="hint block">Se rellena con los datos del expediente; puedes cambiarlo.</span>}
            </label>
          );
        })}
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="no-print flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Generando…" : submitLabel}
        </button>
        <Link href={cancelHref} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
