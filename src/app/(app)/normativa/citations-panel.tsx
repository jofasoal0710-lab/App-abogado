import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CopyButton } from "@/components/copy-button";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field } from "@/components/ui";
import { db } from "@/db";
import { matterCitations } from "@/db/schema";
import { citationText, legalBasis, NEXUS_URL, NORM_AREAS, NORMS, normReference, SCIJ_URL, type NormArea } from "@/lib/normativa";
import { OpenRegistry } from "../registros/open-registry";
import { addCitationAction, deleteCitationAction } from "./actions";

/** Pestaña «Normativa» del expediente: normas citadas, que forman el fundamento de derecho de los escritos. */
export async function CitationsPanel({ matterId }: { matterId: number }) {
  const rows = await db.select().from(matterCitations).where(eq(matterCitations.matterId, matterId)).orderBy(asc(matterCitations.id));
  const basis = legalBasis(rows);
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="card lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold">Fundamento de derecho</h2>
          {rows.length > 0 && <CopyButton text={basis} label="Copiar fundamento" className="btn-secondary btn-sm" />}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Aún no hay normas citadas">
            Cita aquí las normas del caso: los escritos que generes desde este expediente traerán el «Fundamento de derecho» ya redactado.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <p className="max-w-prose text-ink-800">{citationText(c)}</p>
                <div className="flex flex-wrap gap-2">
                  <OpenRegistry url={SCIJ_URL} label="SCIJ" reference={normReference({ name: c.normName, number: c.normNumber })} />
                  <OpenRegistry url={NEXUS_URL} label="Jurisprudencia" reference={normReference({ name: c.normName, number: c.normNumber })} />
                  <form action={deleteCitationAction.bind(null, matterId, c.id)}>
                    <ConfirmButton message="¿Quitar esta cita del expediente?" className="btn-ghost btn-sm text-red-700">
                      Quitar
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
            Se usa como «Fundamento de derecho» al <Link className="link" href={`/formularios?expediente=${matterId}`}>generar un escrito</Link> de este expediente.
          </p>
        )}
      </section>

      <ActionForm action={addCitationAction.bind(null, matterId)} resetOnSuccess className="card card-pad lg:col-span-2">
        <h2 className="mb-3 font-serif text-lg font-semibold">Citar una norma</h2>
        <div className="grid gap-3">
          <Field label="Norma">
            <select className="input" name="normKey" defaultValue="">
              <option value="" disabled>
                Elige del catálogo…
              </option>
              {(Object.keys(NORM_AREAS) as NormArea[]).map((a) => (
                <optgroup key={a} label={NORM_AREAS[a]}>
                  {NORMS.filter((n) => n.area === a).map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.name}
                      {n.number ? ` (Ley ${n.number})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="otra">Otra norma (escribir abajo)</option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Otra norma: nombre" className="sm:col-span-2" hint="Reglamento, decreto, voto…">
              <input className="input" name="customName" maxLength={300} />
            </Field>
            <Field label="N.º de ley">
              <input className="input" name="customNumber" maxLength={30} />
            </Field>
          </div>
          <Field label="Artículos" hint="Por ejemplo: 1, 2 y 45 · 31 al 35">
            <input className="input" name="articles" maxLength={200} />
          </Field>
          <Field label="Nota (opcional)" hint="Para qué se cita">
            <input className="input" name="note" maxLength={1000} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <SubmitButton>Citar</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
