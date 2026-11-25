"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/actions";
import { INTAKE_AREAS } from "@/lib/intake";
import { areaLabels } from "@/lib/labels";
import { IdentityFields } from "../../../clientes/identity-fields";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  req: { id: number; clientType: "persona" | "empresa"; name: string; idType: string | null; taxId: string; birthDate: string; maritalStatus: string | null; email: string; phone: string; address: string; area: string; opposingParty: string; summary: string };
  matches: { id: number; name: string }[];
  lawyers: { id: number; name: string }[];
  defaultResponsibleId?: number;
  conflictCount: number;
  canSetConfidential: boolean;
  today: string;
};

export function AcceptForm({ action, req, matches, lawyers, defaultResponsibleId, conflictCount, canSetConfidential, today }: Props) {
  const [mode, setMode] = useState<"nuevo" | "existente">(matches.length ? "existente" : "nuevo");
  const firstLine = req.summary.split(/[.\n]/)[0]?.trim().slice(0, 80);
  return (
    <ActionForm action={action} className="space-y-6">
      <section className="card card-pad space-y-4" aria-labelledby="cliente">
        <h2 id="cliente" className="font-semibold">1. Cliente</h2>
        {matches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["existente", "nuevo"] as const).map((m) => (
              <label key={m} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium ${mode === m ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 text-ink-700"}`}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                {m === "existente" ? "Es un cliente que ya tenemos" : "Crear un cliente nuevo"}
              </label>
            ))}
          </div>
        )}
        {mode === "existente" && matches.length > 0 ? (
          <label className="block max-w-md">
            <span className="label">Cliente existente</span>
            <select className="input" name="existingClientId" defaultValue={matches[0].id}>
              {matches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <input type="hidden" name="mode" value="nuevo" />
            <p className="text-sm text-ink-600">Datos que envió la persona: complétalos o corrígelos. Los campos con * son obligatorios.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <IdentityFields today={today} initial={{ type: req.clientType, name: req.name, idType: req.idType, taxId: req.taxId, birthDate: req.birthDate, maritalStatus: req.maritalStatus }} />
              <label className="block">
                <span className="label">Correo electrónico *</span>
                <input className="input" type="email" name="email" required defaultValue={req.email} />
              </label>
              <label className="block">
                <span className="label">Teléfono *</span>
                <input className="input" name="phone" required maxLength={40} defaultValue={req.phone} />
              </label>
              <label className="block sm:col-span-3">
                <span className="label">Dirección *</span>
                <input className="input" name="address" required maxLength={500} defaultValue={req.address} />
              </label>
              {canSetConfidential && (
                <label className="block sm:col-span-3">
                  <span className="label">Visibilidad del cliente</span>
                  <select className="input max-w-xs" name="clientVisibility" defaultValue="abierto">
                    <option value="abierto">Abierto (todo el equipo)</option>
                    <option value="confidencial">Confidencial</option>
                  </select>
                </label>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card card-pad space-y-4" aria-labelledby="expediente">
        <h2 id="expediente" className="font-semibold">2. Expediente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Título del asunto *</span>
            <input className="input" name="title" required minLength={3} maxLength={250} defaultValue={firstLine && firstLine.length >= 3 ? firstLine : `Consulta de ${req.name}`} />
          </label>
          <label className="block">
            <span className="label">Área</span>
            <select className="input" name="area" defaultValue={req.area}>
              {INTAKE_AREAS.map((a) => (
                <option key={a} value={a}>
                  {areaLabels[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Responsable</span>
            <select className="input" name="responsibleId" defaultValue={defaultResponsibleId ?? ""}>
              <option value="">— Sin asignar —</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Parte contraria</span>
            <input className="input" name="opposingParty" maxLength={250} defaultValue={req.opposingParty} />
          </label>
          <label className="block">
            <span className="label">Visibilidad</span>
            <select className="input" name="visibility" defaultValue="abierto">
              <option value="abierto">Abierto (todo el equipo)</option>
              <option value="restringido">Restringido</option>
              <option value="confidencial">Confidencial</option>
            </select>
          </label>
        </div>
        <p className="hint">El relato de la persona se copia a la descripción del expediente y sus documentos pasan a la pestaña Documentos.</p>
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="cierre">
        <h2 id="cierre" className="font-semibold">3. Constancia</h2>
        {conflictCount > 0 ? (
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <input type="checkbox" name="conflictsReviewed" required className="mt-0.5 h-4 w-4" />
            <span>
              He revisado las {conflictCount} coincidencia{conflictCount === 1 ? "" : "s"} de la búsqueda de conflictos y no impiden aceptar el caso. *
            </span>
          </label>
        ) : (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ La revisión de conflictos no encontró coincidencias. Quedará constancia al aceptar.</p>
        )}
        <label className="block">
          <span className="label">Nota interna (opcional)</span>
          <textarea className="input min-h-16" name="note" maxLength={2000} />
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingText="Creando…">Crear cliente y expediente</SubmitButton>
          <Link href={`/solicitudes/${req.id}`} className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </section>
    </ActionForm>
  );
}
