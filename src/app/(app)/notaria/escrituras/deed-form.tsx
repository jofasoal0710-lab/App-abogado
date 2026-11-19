import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { ActionState } from "@/lib/actions";

export type DeedValues = {
  number: number;
  volume: string | null;
  folioStart: number | null;
  folioEnd: number | null;
  grantedOn: string;
  grantedAt: string | null;
  act: string;
  notes: string | null;
  status: string;
};

export function DeedForm({ action, values, submitLabel, showStatus = false }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; values: DeedValues; submitLabel: string; showStatus?: boolean }) {
  return (
    <ActionForm action={action} className="card card-pad">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Número">
          <input className="input" name="number" inputMode="numeric" defaultValue={values.number} required />
        </Field>
        <Field label="Tomo">
          <input className="input" name="volume" defaultValue={values.volume ?? ""} maxLength={20} />
        </Field>
        <Field label="Folio inicial">
          <input className="input" name="folioStart" inputMode="numeric" defaultValue={values.folioStart ?? ""} />
        </Field>
        <Field label="Folio final">
          <input className="input" name="folioEnd" inputMode="numeric" defaultValue={values.folioEnd ?? ""} />
        </Field>
        <Field label="Fecha de otorgamiento">
          <input className="input" type="date" name="grantedOn" defaultValue={values.grantedOn} required />
        </Field>
        <Field label="Hora">
          <input className="input" name="grantedAt" defaultValue={values.grantedAt ?? ""} maxLength={60} />
        </Field>
        <Field label="Acto o contrato" className="sm:col-span-2">
          <input className="input" name="act" defaultValue={values.act} required maxLength={300} />
        </Field>
        {showStatus && (
          <Field label="Estado">
            <select className="input" name="status" defaultValue={values.status}>
              <option value="otorgada">Otorgada</option>
              <option value="no_paso">No pasó</option>
            </select>
          </Field>
        )}
        <Field label="Observaciones" className={showStatus ? "sm:col-span-3" : "sm:col-span-4"}>
          <textarea className="input min-h-20" name="notes" defaultValue={values.notes ?? ""} maxLength={2000} />
        </Field>
      </div>
      <div className="mt-4">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
