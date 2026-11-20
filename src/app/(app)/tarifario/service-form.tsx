import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { FeeGuideButton } from "@/components/fee-guide";
import { Field } from "@/components/ui";
import type { FeeService } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { ARANCEL, ARANCEL_AREAS } from "@/lib/arancel";
import { FEE_MODE_LABELS, stagesToText } from "@/lib/fees";

const colones = (c: number | null | undefined) => (c != null ? String(Math.round(c / 100)) : "");
const percent = (bp: number | null | undefined) => (bp ? (bp / 100).toLocaleString("es-CR") : "");

export function ServiceForm({ action, service }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; service?: FeeService }) {
  return (
    <ActionForm action={action} className="card card-pad space-y-5">
      <div className="flex justify-end">
        <FeeGuideButton label="Ver el arancel oficial" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del servicio o proceso" className="sm:col-span-2" hint="Como lo ofreces al cliente: «Traspaso de vehículo», «Proceso laboral ordinario»…">
          <input className="input" name="name" defaultValue={service?.name} required maxLength={200} />
        </Field>
        <Field label="Área">
          <select className="input" name="area" defaultValue={service?.area ?? "abogacia"}>
            {Object.entries(ARANCEL_AREAS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
            <option value="otros">Otros</option>
          </select>
        </Field>
        <Field label="Forma de cobro">
          <select className="input" name="mode" defaultValue={service?.mode ?? "fijo"}>
            {Object.entries(FEE_MODE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Precio (₡) — monto fijo" hint="Solo si se cobra un monto fijo por el proceso">
          <input className="input" name="amount" defaultValue={colones(service?.amountCents)} inputMode="decimal" />
        </Field>
        <Field label="Tarifa por hora (₡) — por horas">
          <input className="input" name="hourlyRate" defaultValue={colones(service?.hourlyRateCents)} inputMode="decimal" />
        </Field>
        <Field label="Porcentaje de la cuantía (%)" hint="p. ej. 2,5">
          <input className="input" name="percent" defaultValue={percent(service?.percentBp)} inputMode="decimal" />
        </Field>
        <Field label="Mínimo a cobrar (₡)" hint="Para porcentaje o arancel: nunca menos de esto">
          <input className="input" name="minimum" defaultValue={colones(service?.minimumCents)} inputMode="decimal" />
        </Field>
        <Field label="Referencia del arancel oficial" className="sm:col-span-2" hint="Para comparar tu precio con el mínimo legal (y calcularlo, si cobras «según el arancel»)">
          <select className="input" name="arancelKey" defaultValue={service?.arancelKey ?? ""}>
            <option value="">— Sin referencia —</option>
            {Object.entries(ARANCEL_AREAS).map(([area, label]) => (
              <optgroup key={area} label={label}>
                {ARANCEL.filter((i) => i.area === area).map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.name} ({i.article})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Recargo sobre el arancel (%)" hint="Solo «según el arancel»: p. ej. 20 para cobrar un 20 % más que el mínimo">
          <input className="input" name="markup" defaultValue={percent(service?.markupBp)} inputMode="decimal" />
        </Field>
        <Field label="Etapas de pago" hint="Una por línea: nombre y porcentaje (deben sumar 100). Vacío = un solo pago.">
          <textarea className="input min-h-24" name="stages" defaultValue={stagesToText(service?.stages ?? [])} placeholder={"Presentación de la demanda 50\nSentencia 50"} />
        </Field>
        <Field label="Descripción o condiciones" className="sm:col-span-2">
          <textarea className="input min-h-20" name="description" defaultValue={service?.description ?? ""} maxLength={2000} placeholder="Qué incluye, qué no (timbres y derechos de registro aparte)…" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="active" defaultChecked={service?.active ?? true} />
          Activo (aparece en la guía y en los expedientes)
        </label>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Guardar servicio</SubmitButton>
        <Link href="/tarifario" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
