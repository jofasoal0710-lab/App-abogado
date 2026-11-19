"use client";

import { useState } from "react";
import { ageOn, guessIdType, ID_TYPES, MARITAL_STATUS, type IdType } from "@/lib/cr-id";
import { clientTypeLabels } from "@/lib/labels";

type Initial = {
  type: "persona" | "empresa";
  name: string;
  idType: string | null;
  taxId: string;
  birthDate: string;
  maritalStatus: string | null;
};

/**
 * Tipo, nombre e identificación del cliente, con consulta del nombre en Hacienda, edad calculada al
 * momento a partir de la fecha de nacimiento y estado civil (solo personas físicas).
 */
export function IdentityFields({ initial, today }: { initial: Initial; today: string }) {
  const [type, setType] = useState(initial.type);
  const [name, setName] = useState(initial.name);
  const [idType, setIdType] = useState<string>(initial.idType ?? (initial.type === "empresa" ? "cedula_juridica" : "cedula_fisica"));
  const [taxId, setTaxId] = useState(initial.taxId);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" } | { state: "ok" | "error"; message: string }>({ state: "idle" });

  const age = birthDate ? ageOn(birthDate, today) : null;
  const canLookup = idType !== "pasaporte" && taxId.replace(/\D/g, "").length >= 9;

  async function consult() {
    setLookup({ state: "loading" });
    try {
      const res = await fetch(`/api/hacienda?id=${encodeURIComponent(taxId)}`, { cache: "no-store" });
      const data = (await res.json()) as { name?: string; idType?: IdType | null; status?: string | null; error?: string };
      if (!res.ok || !data.name) return setLookup({ state: "error", message: data.error ?? "No se pudo consultar." });
      setName(data.name);
      if (data.idType) {
        setIdType(data.idType);
        setType(data.idType === "cedula_juridica" ? "empresa" : "persona");
      }
      setLookup({ state: "ok", message: `Nombre traído de Hacienda${data.status ? ` (${data.status})` : ""}. Revísalo antes de guardar.` });
    } catch {
      setLookup({ state: "error", message: "No se pudo consultar. Escribe los datos a mano." });
    }
  }

  return (
    <>
      <label className="block">
        <span className="label">Tipo de cliente</span>
        <select
          className="input"
          name="type"
          value={type}
          onChange={(e) => {
            const t = e.target.value as "persona" | "empresa";
            setType(t);
            // Propone el tipo de identificación habitual de cada tipo de cliente.
            if (t === "empresa" && idType === "cedula_fisica") setIdType("cedula_juridica");
            if (t === "persona" && idType === "cedula_juridica") setIdType("cedula_fisica");
          }}
        >
          {Object.entries(clientTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">{type === "empresa" ? "Razón social" : "Nombre completo"}</span>
        <input className="input" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </label>

      <label className="block">
        <span className="label">Tipo de identificación</span>
        <select className="input" name="idType" value={idType} onChange={(e) => setIdType(e.target.value)}>
          {Object.entries(ID_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <label className="block">
          <span className="label">Número de identificación</span>
          <span className="flex gap-2">
            <input
              className="input"
              name="taxId"
              value={taxId}
              onChange={(e) => {
                setTaxId(e.target.value);
                const guess = guessIdType(e.target.value);
                if (guess && idType !== "pasaporte") setIdType(guess);
              }}
              maxLength={40}
              inputMode={idType === "pasaporte" ? "text" : "numeric"}
              placeholder={idType === "cedula_juridica" ? "3-101-123456" : idType === "cedula_fisica" ? "1-1234-0567" : ""}
              autoComplete="off"
            />
            <button type="button" className="btn-secondary shrink-0" onClick={consult} disabled={!canLookup || lookup.state === "loading"}>
              {lookup.state === "loading" ? "Consultando…" : "Buscar en Hacienda"}
            </button>
          </span>
        </label>
        <p className={`mt-1 text-xs ${lookup.state === "error" ? "text-red-700" : lookup.state === "ok" ? "text-emerald-700" : "text-ink-500"}`} role="status" aria-live="polite">
          {lookup.state === "ok" || lookup.state === "error"
            ? lookup.message
            : "Trae el nombre del registro de contribuyentes de Hacienda (solo si está inscrito). Fecha de nacimiento y estado civil se escriben a mano."}
        </p>
      </div>

      {type === "persona" && (
        <>
          <label className="block">
            <span className="label">Fecha de nacimiento</span>
            <input className="input" type="date" name="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={today} />
            <span className="hint block" aria-live="polite">
              {age !== null ? `Edad: ${age} ${age === 1 ? "año" : "años"}${age < 18 ? " (menor de edad)" : ""}` : "La edad se calcula sola."}
            </span>
          </label>
          <label className="block">
            <span className="label">Estado civil</span>
            <select className="input" name="maritalStatus" defaultValue={initial.maritalStatus ?? ""}>
              <option value="">Sin indicar</option>
              {Object.entries(MARITAL_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  );
}
