import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/actions";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-guide";

type Entry = { title: string; body: string; area: string; keywords: string | null; refs: string | null };

export function KnowledgeForm({ action, entry, submitLabel }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; entry?: Entry; submitLabel: string }) {
  return (
    <ActionForm action={action} className="card card-pad">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Título" className="sm:col-span-2" hint="Como lo preguntarías: «Plazo para apelar una sentencia»">
          <input className="input" name="title" defaultValue={entry?.title ?? ""} required maxLength={200} />
        </Field>
        <Field label="Área">
          <select className="input" name="area" defaultValue={entry?.area ?? "despacho"}>
            {Object.entries(KNOWLEDGE_AREAS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contenido" className="sm:col-span-3" hint="Explicación, pasos, plazos, requisitos… Usa guiones para listas.">
          <textarea className="input min-h-64 leading-relaxed" name="body" defaultValue={entry?.body ?? ""} required maxLength={20000} spellCheck lang="es" />
        </Field>
        <Field label="Palabras y preguntas relacionadas" className="sm:col-span-3" hint="Sinónimos y formas de preguntarlo: «apelar, recurrir, cuánto tiempo tengo para…». Ayudan al asistente a encontrarla.">
          <input className="input" name="keywords" defaultValue={entry?.keywords ?? ""} maxLength={1000} />
        </Field>
        <Field label="Referencias legales (opcional)" className="sm:col-span-3" hint="Formato: ley-2:28,29; ley-9342:67 (clave de la ley en Normativa y artículos)">
          <input className="input font-mono text-sm" name="refs" defaultValue={entry?.refs ?? ""} maxLength={500} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
