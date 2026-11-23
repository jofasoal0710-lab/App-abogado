import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { Client } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { formatId } from "@/lib/cr-id";
import { todayISO } from "@/lib/dates";
import { IdentityFields } from "./identity-fields";
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
      <p className="text-sm text-ink-600">Los campos con <span className="font-semibold">*</span> son obligatorios.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <IdentityFields
          today={todayISO()}
          initial={{
            type: client?.type ?? "persona",
            name: client?.name ?? "",
            idType: client?.idType ?? null,
            taxId: client ? formatId(client.idType, client.taxId) : "",
            birthDate: client?.birthDate ?? "",
            maritalStatus: client?.maritalStatus ?? null,
          }}
        />
        <Field label="Correo electrónico *">
          <input className="input" type="email" name="email" required defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Teléfono *">
          <input className="input" name="phone" required defaultValue={client?.phone ?? ""} maxLength={40} />
        </Field>
        <Field label="Dirección *" className="sm:col-span-3">
          <input className="input" name="address" required defaultValue={client?.address ?? ""} maxLength={500} />
        </Field>
        {!client && canSetConfidential && (
          <Field label="Visibilidad" hint="Confidencial: solo lo verás tú y quien tenga acceso a sus expedientes." className="sm:col-span-3">
            <select className="input max-w-xs" name="visibility" defaultValue="abierto">
              <option value="abierto">Abierto (todo el equipo)</option>
              <option value="confidencial">Confidencial</option>
            </select>
          </Field>
        )}
        <Field label="Notas internas (opcional)" className="sm:col-span-3">
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
