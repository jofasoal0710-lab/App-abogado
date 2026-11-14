import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { addTimeEntryAction } from "./actions";

export function TimeEntryForm({
  matterId,
  matterOptions,
  defaultRateCents,
}: {
  /** Si se indica, el expediente queda fijo; si no, se muestra un selector. */
  matterId?: number;
  matterOptions?: { id: number; label: string }[];
  defaultRateCents: number;
}) {
  const rate = (defaultRateCents / 100).toFixed(2).replace(".", ",");
  return (
    <ActionForm action={addTimeEntryAction} resetOnSuccess className="card card-pad">
      <div className="grid gap-3 sm:grid-cols-6">
        {matterId ? (
          <input type="hidden" name="matterId" value={matterId} />
        ) : (
          <Field label="Expediente" className="sm:col-span-3">
            <select className="input" name="matterId" required defaultValue="">
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
          <input className="input" type="date" name="workedOn" defaultValue={todayISO()} required />
        </Field>
        <Field label="Duración" className="sm:col-span-1" hint="1:30 · 90m · 1,5">
          <input className="input" name="duration" placeholder="1:30" required />
        </Field>
        <Field label="€ / hora" className="sm:col-span-1">
          <input className="input" name="rate" defaultValue={rate} inputMode="decimal" />
        </Field>
        <Field label="Trabajo realizado" className="sm:col-span-6">
          <input className="input" name="description" placeholder="Redacción de la demanda, reunión con el cliente…" required maxLength={1000} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="billable" defaultChecked />
          Facturable
        </label>
        <SubmitButton pendingText="Registrando…">Registrar horas</SubmitButton>
      </div>
    </ActionForm>
  );
}
