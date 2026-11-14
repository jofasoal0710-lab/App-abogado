import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { CalendarEvent } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { toDateTimeLocalValue } from "@/lib/dates";
import { entries, eventKindLabels } from "@/lib/labels";

export function EventForm({
  action,
  event,
  matters,
  users,
  defaultMatterId,
  defaultAssignedId,
  returnTo,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  event?: CalendarEvent;
  matters: { id: number; label: string }[];
  users: { id: number; name: string }[];
  defaultMatterId?: number;
  defaultAssignedId?: number;
  returnTo: string;
}) {
  const startDefault = event ? toDateTimeLocalValue(event.startsAt) : "";
  const endDefault = event?.endsAt ? toDateTimeLocalValue(event.endsAt) : "";
  return (
    <ActionForm action={action} className="card card-pad space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" className="sm:col-span-2">
          <input className="input" name="title" defaultValue={event?.title} required maxLength={250} />
        </Field>
        <Field label="Tipo">
          <select className="input" name="kind" defaultValue={event?.kind ?? "plazo"}>
            {entries(eventKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsable">
          <select className="input" name="assignedId" defaultValue={event?.assignedId ?? defaultAssignedId ?? ""}>
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inicio / vencimiento">
          <input className="input" type="datetime-local" name="startsAt" defaultValue={startDefault} required />
        </Field>
        <Field label="Fin (opcional)">
          <input className="input" type="datetime-local" name="endsAt" defaultValue={endDefault} />
        </Field>
        <Field label="Expediente" className="sm:col-span-2">
          <select className="input" name="matterId" defaultValue={event?.matterId ?? defaultMatterId ?? ""}>
            <option value="">Sin expediente</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lugar" className="sm:col-span-2">
          <input className="input" name="location" defaultValue={event?.location ?? ""} maxLength={250} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <textarea className="input min-h-24" name="notes" defaultValue={event?.notes ?? ""} maxLength={5000} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Guardar</SubmitButton>
        <Link href={returnTo} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
