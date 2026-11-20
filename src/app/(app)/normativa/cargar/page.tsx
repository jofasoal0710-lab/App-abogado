import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { loadedLaws } from "@/lib/laws";
import { NORM_AREAS, NORMS, type NormArea } from "@/lib/normativa";
import { loadLawTextAction } from "../actions";

export const metadata: Metadata = { title: "Cargar texto de una ley" };

export default async function LoadLawPage() {
  await requirePermission("equipo.gestionar");
  const loaded = await loadedLaws();
  return (
    <>
      <PageHeader
        title="Cargar texto de una ley"
        subtitle="Para leerla y buscarla dentro de la app. Si ya estaba cargada, se sustituye por la nueva versión."
        actions={
          <Link className="btn-secondary" href="/normativa">
            Volver a normativa
          </Link>
        }
      />
      <ActionForm action={loadLawTextAction} className="card card-pad">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
          <li>Abre la ley en el SCIJ («Texto completo», versión vigente).</li>
          <li>Selecciona todo el texto (Ctrl+A), cópialo (Ctrl+C) y pégalo abajo, o súbelo como archivo .txt.</li>
          <li>Indica la versión que muestra el SCIJ (por ejemplo «Versión 64 de 64») y guarda: la app separa los artículos sola.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ley">
            <select className="input" name="normKey" required defaultValue="">
              <option value="" disabled>
                Elige la ley…
              </option>
              {(Object.keys(NORM_AREAS) as NormArea[]).map((a) => (
                <optgroup key={a} label={NORM_AREAS[a]}>
                  {NORMS.filter((n) => n.area === a).map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.name}
                      {n.number ? ` (Ley ${n.number})` : ""}
                      {loaded.has(n.key) ? " · ya cargada" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Versión" hint="Como la muestra el SCIJ">
            <input className="input" name="versionLabel" maxLength={120} placeholder="Versión 64 de 64" />
          </Field>
          <Field label="Fecha de la copia">
            <input className="input" type="date" name="retrievedOn" defaultValue={todayISO()} max={todayISO()} required />
          </Field>
          <Field label="Enlace de origen (opcional)">
            <input className="input" name="sourceUrl" maxLength={500} placeholder="https://…" />
          </Field>
          <Field label="Texto completo" className="sm:col-span-2">
            <textarea className="input min-h-48 font-mono text-xs" name="text" />
          </Field>
          <Field label="…o archivo .txt" className="sm:col-span-2">
            <input className="input" type="file" name="file" accept=".txt,text/plain" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <SubmitButton pendingText="Procesando…">Cargar texto</SubmitButton>
        </div>
      </ActionForm>
      {loaded.size > 0 && (
        <section className="card mt-6">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Leyes cargadas</h2>
          <ul className="divide-y divide-ink-100 text-sm">
            {[...loaded.values()].map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                <Link className="link" href={`/normativa/${l.normKey}`}>
                  {l.title}
                </Link>
                <span className="text-ink-500">
                  {l.articleCount} artículos · {l.versionLabel ?? "sin versión"} · {formatDate(l.retrievedOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
