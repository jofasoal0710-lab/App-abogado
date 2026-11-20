"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/actions";
import type { Block, Field, Values } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import type { FieldIssues } from "@/lib/spellcheck";
import { ArticlePicker, PreviewDialog, SpellingPanel } from "./form-tools";
import { checkSpellingAction } from "./tools-actions";

/**
 * Campos de un formulario. Enter NO envía (solo el botón): así no se genera un escrito a medias por
 * error. Los campos van sin texto de ejemplo dentro; las indicaciones van debajo, en pequeño.
 * Herramientas: añadir artículos de ley al fundamento de derecho, vista previa y revisión ortográfica.
 */
export function WritingForm({
  action,
  templateKey,
  fields,
  values,
  title,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  templateKey: string;
  fields: Field[];
  values: Values;
  title: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Block[] | null>(null);
  const [spelling, setSpelling] = useState<FieldIssues[] | null>(null);
  const [checking, startCheck] = useTransition();

  const element = (name: string) => formRef.current?.elements.namedItem(`f_${name}`) as HTMLInputElement | HTMLTextAreaElement | null;
  const currentValues = (): Values => Object.fromEntries(fields.map((f) => [f.name, element(f.name)?.value ?? ""]));

  const appendTo = (name: string, text: string) => {
    const el = element(name);
    if (!el) return;
    el.value = el.value.trim() ? `${el.value.replace(/\s+$/, "")}\n${text}` : text;
    el.focus();
  };
  const replaceIn = (name: string, word: string, replacement: string) => {
    const el = element(name);
    if (!el) return;
    const i = el.value.indexOf(word);
    if (i >= 0) el.value = el.value.slice(0, i) + replacement + el.value.slice(i + word.length);
  };

  return (
    <form
      ref={formRef}
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
            <div key={f.name} className={wide ? "sm:col-span-2" : ""}>
              <label className="block">
                <span className="label">
                  {f.label}
                  {f.required && <span className="text-red-700"> *</span>}
                </span>
                {wide ? (
                  <textarea
                    className={`input ${f.name === "hechos" ? "min-h-72" : "min-h-32"} leading-relaxed`}
                    name={`f_${f.name}`}
                    defaultValue={values[f.name] ?? ""}
                    spellCheck
                    lang="es"
                  />
                ) : (
                  <input className="input" type={f.type === "date" ? "date" : "text"} name={`f_${f.name}`} defaultValue={values[f.name] ?? ""} spellCheck lang="es" />
                )}
                {f.hint && <span className="hint block">{f.hint}</span>}
                {f.auto && !f.hint && <span className="hint block">Se rellena con los datos del expediente; puedes cambiarlo.</span>}
              </label>
              {f.name === "derecho" && <ArticlePicker onInsert={(t) => appendTo(f.name, t)} />}
            </div>
          );
        })}
      </div>

      {spelling && <SpellingPanel results={spelling} onFix={replaceIn} onClose={() => setSpelling(null)} />}

      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="no-print flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Generando…" : submitLabel}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const tpl = getTemplate(templateKey);
            if (tpl) setPreview(tpl.render(currentValues()));
          }}
        >
          Vista previa
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={checking}
          onClick={() => {
            const payload = fields.filter((f) => f.type !== "date").map((f) => ({ field: f.name, label: f.label, text: element(f.name)?.value ?? "" }));
            startCheck(async () => setSpelling(await checkSpellingAction(payload)));
          }}
        >
          {checking ? "Revisando…" : "Revisar ortografía"}
        </button>
        <Link href={cancelHref} className="btn-secondary">
          Cancelar
        </Link>
      </div>
      {preview && <PreviewDialog blocks={preview} onClose={() => setPreview(null)} />}
    </form>
  );
}
