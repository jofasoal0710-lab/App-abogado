import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { Matter } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { areaLabels, entries } from "@/lib/labels";
import type { GuideService } from "@/lib/tariff";
import { BillingFields } from "./billing-fields";

type Option = { id: number; name: string };

export function MatterForm({
  action,
  matter,
  clients,
  lawyers,
  defaultClientId,
  defaultResponsibleId,
  canChangeResponsible = true,
  cancelHref,
  services,
  adjustBp,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  matter?: Matter;
  clients: Option[];
  lawyers: Option[];
  defaultClientId?: number;
  defaultResponsibleId?: number;
  /** Falso si no puedes cambiar el responsable (no eres administrador ni el responsable actual). */
  canChangeResponsible?: boolean;
  cancelHref: string;
  /** Tarifario activo (guía de precios) y ajuste del arancel. */
  services: GuideService[];
  adjustBp: number;
}) {
  return (
    <ActionForm action={action} className="card card-pad space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título del expediente" className="sm:col-span-2">
          <input className="input" name="title" defaultValue={matter?.title} required maxLength={250} />
        </Field>
        <Field label="Cliente">
          <select className="input" name="clientId" defaultValue={matter?.clientId ?? defaultClientId ?? ""} required>
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Abogado responsable">
          <select className="input" name="responsibleId" defaultValue={matter?.responsibleId ?? defaultResponsibleId ?? ""} disabled={!canChangeResponsible}>
            <option value="">Sin asignar</option>
            {lawyers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        {!matter && (
          <Field label="Visibilidad" hint="Restringido: responsable, miembros y administradores. Confidencial: solo responsable y miembros (ni los administradores); exige responsable. Podrás cambiarlo en la pestaña Acceso.">
            <select className="input" name="visibility" defaultValue="abierto">
              <option value="abierto">Abierto (todo el equipo)</option>
              <option value="restringido">Restringido (miembros y administradores)</option>
              <option value="confidencial">Confidencial (ni los administradores)</option>
            </select>
          </Field>
        )}
        <Field label="Área">
          <select className="input" name="area" defaultValue={matter?.area ?? "otros"}>
            {entries(areaLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de apertura">
          <input className="input" type="date" name="openedAt" defaultValue={matter?.openedAt ?? todayISO()} required />
        </Field>
        <Field label="Juzgado o tribunal">
          <input className="input" name="court" defaultValue={matter?.court ?? ""} maxLength={250} />
        </Field>
        <Field label="Nº de procedimiento">
          <input className="input" name="courtCaseNumber" defaultValue={matter?.courtCaseNumber ?? ""} maxLength={100} />
        </Field>
        <Field label="Parte contraria" className="sm:col-span-2">
          <input className="input" name="opposingParty" defaultValue={matter?.opposingParty ?? ""} maxLength={250} />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className="input min-h-28" name="description" defaultValue={matter?.description ?? ""} maxLength={10000} />
        </Field>
        <BillingFields
          services={services}
          adjustBp={adjustBp}
          initial={{
            billingType: matter?.billingType ?? "por_horas",
            serviceId: matter?.serviceId ?? null,
            feeBaseCents: matter?.feeBaseCents ?? null,
            fixedFeeCents: matter?.fixedFeeCents ?? null,
            hourlyRateCents: matter?.hourlyRateCents ?? null,
          }}
        />
      </div>
      <div className="flex gap-2">
        <SubmitButton>Guardar expediente</SubmitButton>
        <Link href={cancelHref} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
