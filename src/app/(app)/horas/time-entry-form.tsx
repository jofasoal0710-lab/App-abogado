import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import type { ActionState } from "@/lib/actions";
import { addTimeEntryAction } from "./actions";

/** Entrada existente que se está corrigiendo. */
export type EditableEntry = { matterId: number; workedOn: string; minutes: number; rateCents: number; description: string; billable: boolean };

const asDuration = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export function TimeEntryForm({
  matterId,
  matterOptions,
  defaultRateCents,
  entry,
  action,
}: {
  /** Si se indica, el expediente queda fijo; si no, se muestra un selector. */
  matterId?: number;
  matterOptions?: { id: number; label: string }[];
  defaultRateCents: number;
  /** Para corregir una entrada: sus valores actuales y la acción que la guarda. */
  entry?: EditableEntry;
  action?: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const rate = ((entry?.rateCents ?? defaultRateCents) / 100).toFixed(2).replace(".", ",");
  return (
    <ActionForm action={action ?? addTimeEntryAction} resetOnSuccess={!entry} className="card card-pad">
      <div className="grid gap-3 sm:grid-cols-6">
        {matterId ? (
          <input type="hidden" name="matterId" value={matterId} />
        ) : (
          <Field label="Expediente" className="sm:col-span-3">
            <select className="input" name="matterId" required defaultValue={entry ? String(entry.matterId) : ""}>
              <option value="" disabled>
                Selecciona…
              </option>
              {matterOptions?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Fecha" className={matterId ? "sm:col-span-2" : "sm:col-span-1"}>
          <input className="input" type="date" name="workedOn" defaultValue={entry?.workedOn ?? todayISO()} required />
        </Field>
        <Field label="Duración" className="sm:col-span-1" hint="1:30 · 90m · 1,5">
          <input className="input" name="duration" placeholder="1:30" defaultValue={entry ? asDuration(entry.minutes) : undefined} required />
        </Field>
        <Field label="Tarifa / hora" className="sm:col-span-1">
          <input className="input" name="rate" defaultValue={rate} inputMode="decimal" />
        </Field>
        <Field label="Trabajo realizado" className="sm:col-span-6">
          <input className="input" name="description" placeholder="Redacción de la demanda, reunión con el cliente…" defaultValue={entry?.description} required maxLength={1000} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="billable" defaultChecked={entry ? entry.billable : true} />
          Facturable
        </label>
        <SubmitButton pendingText={entry ? "Guardando…" : "Registrando…"}>{entry ? "Guardar cambios" : "Registrar horas"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
