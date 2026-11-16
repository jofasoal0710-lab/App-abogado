"use client";

import { useRef, useState } from "react";
import { Field } from "@/components/ui";
import { finalizeUploadAction, prepareUploadAction } from "./actions";

type Phase = "idle" | "preparing" | "uploading" | "finishing";

const LABEL: Record<Phase, string> = { idle: "Subir documento", preparing: "Preparando…", uploading: "Subiendo…", finishing: "Registrando…" };

/**
 * Subida directa al almacenamiento S3: el fichero NO pasa por el servidor (en Netlify las funciones
 * admiten ~6 MB por petición). 1) el servidor autoriza y da una URL prefirmada, 2) el navegador sube
 * el fichero al bucket, 3) el servidor verifica en el bucket que está y lo registra.
 */
export function DirectUploadForm({ matterId, categories }: { matterId: number; categories: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const data = new FormData(e.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Selecciona un archivo.");
    const category = String(data.get("category") ?? "") || null;

    try {
      setPhase("preparing");
      const prep = await prepareUploadAction(matterId, { name: file.name, size: file.size, category });
      if ("error" in prep) return setError(prep.error);

      setPhase("uploading");
      let res: Response;
      try {
        res = await fetch(prep.url, { method: "PUT", body: file });
      } catch {
        return setError("No se pudo subir el archivo al almacenamiento. Si el problema persiste, el administrador debe revisar la configuración CORS del bucket.");
      }
      if (!res.ok) return setError(`El almacenamiento rechazó la subida (HTTP ${res.status}).`);

      setPhase("finishing");
      const fin = await finalizeUploadAction(prep.token);
      if (fin?.error) return setError(fin.error);
      setOk(fin?.ok ?? "Documento subido.");
      formRef.current?.reset();
    } finally {
      setPhase("idle");
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card card-pad">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Archivo" className="sm:col-span-2" hint="Máximo 25 MB. PDF, Word, Excel, imágenes, correos…">
          <input className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-2 file:py-1" type="file" name="file" required />
        </Field>
        <Field label="Categoría">
          <select className="input" name="category" defaultValue="">
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className="btn-primary" disabled={phase !== "idle"}>
          {LABEL[phase]}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {ok}
        </p>
      )}
    </form>
  );
}
