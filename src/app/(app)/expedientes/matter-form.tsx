import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { Matter } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { areaLabels, billingTypeLabels, entries } from "@/lib/labels";

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
}) {
  const fee = matter?.fixedFeeCents != null ? (matter.fixedFeeCents / 100).toFixed(2).replace(".", ",") : "";
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
          <Field label="Visibilidad" hint="Restringido: solo el responsable, los miembros que añadas y los administradores. Podrás cambiarlo en la pestaña Acceso.">
            <select className="input" name="visibility" defaultValue="abierto">
              <option value="abierto">Abierto (todo el equipo)</option>
              <option value="restringido">Restringido (confidencial)</option>
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
        <Field label="Modalidad de honorarios">
          <select className="input" name="billingType" defaultValue={matter?.billingType ?? "por_horas"}>
            {entries(billingTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Honorarios pactados (solo tarifa fija)" hint="Importe sin IVA, p. ej. 1.500,00">
          <input className="input" name="fixedFee" defaultValue={fee} inputMode="decimal" />
        </Field>
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
