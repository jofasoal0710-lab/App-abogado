"use client";

import { startTransition, useActionState, useState } from "react";
import { ID_TYPES, MARITAL_STATUS } from "@/lib/cr-id";
import { CONTACT_OPTIONS, INTAKE_AREAS, INTAKE_MAX_FILES, INTAKE_MAX_FILE_BYTES } from "@/lib/intake";
import { areaLabels } from "@/lib/labels";
import { Turnstile } from "@/components/turnstile";
import { submitIntakeAction } from "./actions";

const AREA_HELP: Record<string, string> = {
  laboral: "Despidos, liquidaciones, salarios, riesgos del trabajo",
  familia: "Divorcio, pensión alimentaria, custodia, régimen de visitas",
  penal: "Denuncias, defensa, querellas",
  civil: "Deudas, contratos, cobros, daños",
  mercantil: "Sociedades, contratos comerciales",
  inmobiliario: "Compraventa, alquileres, propiedades",
  administrativo: "Trámites y reclamos ante el Estado o municipalidades",
  fiscal: "Impuestos y Hacienda",
  otros: "No sé / otro tema",
};

/** Formulario público de solicitud: datos de contacto, el caso, documentos y aviso de privacidad. */
export function IntakeForm({ firmName, today, siteKey, nonce }: { firmName: string; today: string; siteKey?: string | null; nonce?: string }) {
  const [state, formAction, pending] = useActionState(submitIntakeAction, undefined);
  const [type, setType] = useState<"persona" | "empresa">("persona");
  const [fileNote, setFileNote] = useState<string | null>(null);
  const persona = type === "persona";

  return (
    <form
      className="space-y-6"
      noValidate={false}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {state?.errors?.length ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Revisa lo siguiente:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Trampa para robots: invisible para las personas y fuera del orden de tabulación. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          No rellenar
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className="card card-pad space-y-4" aria-labelledby="s1">
        <h2 id="s1" className="font-serif text-xl font-semibold">1. Tus datos</h2>
        <fieldset>
          <legend className="label">¿Quién hace la consulta?</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["persona", "empresa"] as const).map((t) => (
              <label key={t} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium ${type === t ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 text-ink-700"}`}>
                <input type="radio" name="clientType" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {t === "persona" ? "Una persona" : "Una empresa"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">{persona ? "Nombre completo *" : "Razón social *"}</span>
            <input className="input" name="name" required minLength={3} maxLength={200} autoComplete={persona ? "name" : "organization"} />
          </label>
          <label className="block">
            <span className="label">Correo electrónico *</span>
            <input className="input" type="email" name="email" required maxLength={200} autoComplete="email" />
          </label>
          <label className="block">
            <span className="label">Teléfono *</span>
            <input className="input" type="tel" name="phone" required maxLength={40} autoComplete="tel" inputMode="tel" placeholder="8888-8888" />
          </label>
          <label className="block">
            <span className="label">Tipo de identificación</span>
            <select className="input" name="idType" defaultValue={persona ? "cedula_fisica" : "cedula_juridica"} key={type}>
              {Object.entries(ID_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Número de identificación</span>
            <input className="input" name="taxId" maxLength={40} inputMode="numeric" placeholder={persona ? "1-2345-6789" : "3-101-123456"} />
          </label>
          {persona && (
            <>
              <label className="block">
                <span className="label">Fecha de nacimiento</span>
                <input className="input" type="date" name="birthDate" max={today} />
              </label>
              <label className="block">
                <span className="label">Estado civil</span>
                <select className="input" name="maritalStatus" defaultValue="">
                  <option value="">—</option>
                  {Object.entries(MARITAL_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="block sm:col-span-2">
            <span className="label">Dirección</span>
            <input className="input" name="address" maxLength={500} autoComplete="street-address" placeholder="Provincia, cantón, distrito y señas" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">¿Cómo prefieres que te contactemos?</span>
            <select className="input" name="preferredContact" defaultValue="">
              <option value="">Me da igual</option>
              {Object.entries(CONTACT_OPTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card card-pad space-y-4" aria-labelledby="s2">
        <h2 id="s2" className="font-serif text-xl font-semibold">2. Tu caso</h2>
        <label className="block">
          <span className="label">¿De qué tema se trata?</span>
          <select className="input" name="area" defaultValue="otros">
            {INTAKE_AREAS.map((a) => (
              <option key={a} value={a}>
                {a === "otros" ? AREA_HELP.otros : `${areaLabels[a]} — ${AREA_HELP[a]}`}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Cuéntanos qué pasó y qué necesitas *</span>
          <textarea className="input min-h-40" name="summary" required minLength={20} maxLength={5000} placeholder="Qué ocurrió, cuándo, y qué te gustaría conseguir. No hace falta usar términos legales." />
          <span className="hint block">Máximo 5.000 caracteres.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">¿Contra quién o con quién es el problema?</span>
            <input className="input" name="opposingParty" maxLength={250} placeholder="Nombre de la persona o empresa (si lo sabes)" />
            <span className="hint block">Nos sirve para comprobar que podemos llevar tu caso.</span>
          </label>
          <label className="block">
            <span className="label">¿Hay alguna fecha límite?</span>
            <input className="input" type="date" name="deadline" />
            <span className="hint block">Una audiencia, un plazo que te notificaron…</span>
          </label>
        </div>
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="s3">
        <h2 id="s3" className="font-serif text-xl font-semibold">3. Documentos <span className="text-base font-normal text-ink-500">(opcional)</span></h2>
        <p className="text-sm text-ink-600">
          Hasta {INTAKE_MAX_FILES} archivos de {INTAKE_MAX_FILE_BYTES / 1024 / 1024} MB cada uno: PDF, fotos (JPG, PNG) o Word (.docx). Por ejemplo, una notificación, un contrato o la carta de despido.
        </p>
        <input
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700"
          type="file"
          name="files"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
          onChange={(e) => {
            const fs = [...(e.currentTarget.files ?? [])];
            const big = fs.filter((f) => f.size > INTAKE_MAX_FILE_BYTES);
            setFileNote(fs.length > INTAKE_MAX_FILES ? `Has elegido ${fs.length} archivos: el máximo es ${INTAKE_MAX_FILES}.` : big.length ? `Demasiado grande: ${big.map((f) => f.name).join(", ")}.` : null);
          }}
        />
        {fileNote && (
          <p role="alert" className="text-sm text-red-700">
            {fileNote}
          </p>
        )}
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="s4">
        <h2 id="s4" className="font-serif text-xl font-semibold">4. Protección de tus datos</h2>
        <div className="space-y-2 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
          <p>
            <strong>{firmName}</strong> es responsable de los datos que envías. Los usaremos solo para estudiar tu consulta, comprobar que no existe un conflicto de interés y
            contactarte. Pueden incluir datos sensibles (por ejemplo, de familia o de salud) si los cuentas en tu relato.
          </p>
          <p>
            No los compartimos con terceros. Si no llegamos a llevar tu caso, se eliminan en un plazo máximo de 6 meses. Puedes pedir en cualquier momento acceder a ellos,
            corregirlos o eliminarlos (Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales, n.º 8968), escribiendo al despacho.
          </p>
          <p>Enviar esta solicitud no crea todavía una relación profesional: te confirmaremos si podemos atender tu caso.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4" />
          <span>He leído el aviso y acepto que el despacho trate mis datos para estudiar mi consulta. *</span>
        </label>
      </section>

      {siteKey && <Turnstile siteKey={siteKey} action="solicitud" nonce={nonce} />}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={pending}>
          {pending ? "Enviando…" : "Enviar solicitud"}
        </button>
        <span className="text-sm text-ink-500">Los campos con * son obligatorios.</span>
      </div>
    </form>
  );
}
