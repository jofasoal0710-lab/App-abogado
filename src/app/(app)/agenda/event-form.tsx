import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import type { CalendarEvent } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { toDateTimeLocalValue } from "@/lib/dates";
import { entries, eventKindLabels } from "@/lib/labels";
import { HEARING_MODES, HEARING_TYPES } from "@/lib/hearings";

export function EventForm({
  action,
  event,
  matters,
  users,
  defaultMatterId,
  defaultAssignedId,
  defaultKind,
  returnTo,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  event?: CalendarEvent;
  matters: { id: number; label: string }[];
  users: { id: number; name: string }[];
  defaultMatterId?: number;
  defaultAssignedId?: number;
  defaultKind?: string;
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
          <select className="input" name="kind" defaultValue={event?.kind ?? defaultKind ?? "plazo"}>
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
        <Field label="Lugar (despacho y sala)" className="sm:col-span-2">
          <input className="input" name="location" defaultValue={event?.location ?? ""} maxLength={250} />
        </Field>
        <fieldset className="grid gap-4 rounded-md border border-ink-200 p-4 sm:col-span-2 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium text-ink-700">Si es una audiencia</legend>
          <Field label="Tipo de audiencia">
            <select className="input" name="hearingType" defaultValue={event?.hearingType ?? ""}>
              <option value="">—</option>
              {HEARING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modalidad">
            <select className="input" name="hearingMode" defaultValue={event?.hearingMode ?? ""}>
              <option value="">—</option>
              {Object.entries(HEARING_MODES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enlace de la sala virtual" hint="Teams, Zoom… (https://)">
            <input className="input" type="url" name="meetingUrl" defaultValue={event?.meetingUrl ?? ""} placeholder="https://" maxLength={1000} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-3">
            <input type="checkbox" name="ignorarChoque" />
            Guardar aunque choque con otra audiencia de la misma persona
          </label>
        </fieldset>
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
