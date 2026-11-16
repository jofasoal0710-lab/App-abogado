import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { Client } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { clientTypeLabels, entries } from "@/lib/labels";
import Link from "next/link";

export function ClientForm({
  action,
  client,
  canSetConfidential = false,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  client?: Client;
  /** Solo en el alta, y no para asistentes. */
  canSetConfidential?: boolean;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action} className="card card-pad space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tipo">
          <select className="input" name="type" defaultValue={client?.type ?? "persona"}>
            {entries(clientTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre o razón social" className="sm:col-span-2">
          <input className="input" name="name" defaultValue={client?.name} required maxLength={200} />
        </Field>
        <Field label="NIF / DNI / CIF">
          <input className="input" name="taxId" defaultValue={client?.taxId ?? ""} maxLength={40} />
        </Field>
        <Field label="Correo electrónico">
          <input className="input" type="email" name="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Teléfono">
          <input className="input" name="phone" defaultValue={client?.phone ?? ""} maxLength={40} />
        </Field>
        <Field label="Dirección" className="sm:col-span-3">
          <input className="input" name="address" defaultValue={client?.address ?? ""} maxLength={500} />
        </Field>
        {!client && canSetConfidential && (
          <Field label="Visibilidad" hint="Confidencial: solo lo verás tú y quien tenga acceso a sus expedientes." className="sm:col-span-3">
            <select className="input max-w-xs" name="visibility" defaultValue="abierto">
              <option value="abierto">Abierto (todo el equipo)</option>
              <option value="confidencial">Confidencial</option>
            </select>
          </Field>
        )}
        <Field label="Notas internas" className="sm:col-span-3">
          <textarea className="input min-h-24" name="notes" defaultValue={client?.notes ?? ""} maxLength={5000} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Guardar cliente</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
