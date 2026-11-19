import { desc, eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field } from "@/components/ui";
import { db } from "@/db";
import { registryChecks, users } from "@/db/schema";
import { MARITAL_STATUS, type MaritalStatus } from "@/lib/cr-id";
import { formatDate, formatDateTime } from "@/lib/dates";
import { REGISTRY_KINDS, REGISTRY_SOURCES, type RegistryKind, type RegistrySource } from "@/lib/registries";
import { addRegistryCheckAction, applyCheckToClientAction, deleteRegistryCheckAction } from "./actions";
import { OpenRegistry } from "./open-registry";

/**
 * Consultas a registros públicos de un cliente o un expediente: accesos directos a la consulta oficial
 * (con la referencia copiada) y el registro de lo que se verificó.
 */
export async function RegistryPanel({
  target,
  defaultReference,
  defaultKind,
  userId,
  isPerson = false,
}: {
  target: { clientId?: number; matterId?: number };
  defaultReference: string;
  defaultKind: RegistryKind;
  userId: number;
  isPerson?: boolean;
}) {
  const rows = await db
    .select({ c: registryChecks, author: users.name })
    .from(registryChecks)
    .leftJoin(users, eq(users.id, registryChecks.createdById))
    .where(target.clientId ? eq(registryChecks.clientId, target.clientId) : eq(registryChecks.matterId, target.matterId!))
    .orderBy(desc(registryChecks.createdAt))
    .limit(30);

  return (
    <section className="card">
      <div className="border-b border-ink-100 px-5 py-3">
        <h2 className="font-serif text-lg font-semibold">Consultas registrales</h2>
        <p className="text-xs text-ink-500">TSE y Registro Nacional: se abre la consulta oficial con la referencia copiada; anota aquí lo que verifiques.</p>
      </div>
      <div className="no-print flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
        {(Object.keys(REGISTRY_SOURCES) as RegistrySource[]).map((s) => (
          <OpenRegistry key={s} url={REGISTRY_SOURCES[s].url} label={`Consultar en ${REGISTRY_SOURCES[s].label}`} reference={defaultReference} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Aún no hay consultas anotadas" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map(({ c, author }) => (
            <li key={c.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    {REGISTRY_SOURCES[c.source as RegistrySource]?.label ?? c.source} · {REGISTRY_KINDS[c.kind as RegistryKind]?.label ?? c.kind}: {c.reference}
                    {c.deceased && <span className="badge-red ml-2">Fallecido(a)</span>}
                  </p>
                  {(c.birthDate || c.maritalStatus) && (
                    <p className="text-ink-700">
                      {c.birthDate ? `Nacimiento: ${formatDate(c.birthDate)}` : ""}
                      {c.birthDate && c.maritalStatus ? " · " : ""}
                      {c.maritalStatus ? `Estado civil: ${MARITAL_STATUS[c.maritalStatus as MaritalStatus] ?? c.maritalStatus}` : ""}
                    </p>
                  )}
                  {c.result && <p className="whitespace-pre-wrap text-ink-700">{c.result}</p>}
                  <p className="text-xs text-ink-500">
                    {author ?? "—"} · {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <span className="no-print flex gap-1">
                  {target.clientId && (c.birthDate || c.maritalStatus) && (
                    <form action={applyCheckToClientAction.bind(null, c.id, target.clientId)}>
                      <button className="btn-secondary btn-sm">Aplicar a la ficha</button>
                    </form>
                  )}
                  {c.createdById === userId && (
                    <form action={deleteRegistryCheckAction.bind(null, c.id, target)}>
                      <ConfirmButton message="¿Borrar esta anotación?" className="btn-ghost btn-sm text-red-700">
                        Borrar
                      </ConfirmButton>
                    </form>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={addRegistryCheckAction.bind(null, target)} resetOnSuccess className="no-print border-t border-ink-100 px-5 py-4">
        <p className="mb-3 text-sm font-medium text-ink-800">Anotar una consulta</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Registro">
            <select className="input" name="source" defaultValue={REGISTRY_KINDS[defaultKind].source}>
              {(Object.keys(REGISTRY_SOURCES) as RegistrySource[]).map((s) => (
                <option key={s} value={s}>
                  {REGISTRY_SOURCES[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Qué se consultó">
            <select className="input" name="kind" defaultValue={defaultKind}>
              {(Object.keys(REGISTRY_KINDS) as RegistryKind[]).map((k) => (
                <option key={k} value={k}>
                  {REGISTRY_KINDS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referencia">
            <input className="input" name="reference" defaultValue={defaultReference} required maxLength={120} />
          </Field>
          {isPerson && (
            <>
              <Field label="Fecha de nacimiento (según TSE)">
                <input className="input" type="date" name="birthDate" />
              </Field>
              <Field label="Estado civil (según TSE)">
                <select className="input" name="maritalStatus" defaultValue="">
                  <option value="">Sin indicar</option>
                  {Object.entries(MARITAL_STATUS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-700">
                <input type="checkbox" name="deceased" className="h-4 w-4 accent-brand-600" />
                Consta como fallecido(a)
              </label>
            </>
          )}
          <Field label="Resultado / observaciones" className="sm:col-span-3">
            <textarea className="input min-h-20" name="result" maxLength={5000} />
          </Field>
        </div>
        <div className="mt-3">
          <SubmitButton className="btn-secondary">Anotar consulta</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
