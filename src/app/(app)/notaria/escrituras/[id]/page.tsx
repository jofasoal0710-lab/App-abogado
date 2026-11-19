import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { deedParties, testimonies, writings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { getOwnDeed } from "@/lib/notary";
import { addPartyAction, addTestimonyAction, deletePartyAction, toggleSignatureAction, updateDeedAction } from "../../actions";
import { NotaryNav } from "../../notary-nav";
import { DeedForm } from "../deed-form";

export const metadata: Metadata = { title: "Escritura" };
const ORD = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Sétimo", "Octavo", "Noveno", "Décimo"];

export default async function DeedPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("notaria.usar");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const deed = await getOwnDeed(user.id, id);
  if (!deed) notFound();
  const [parties, tests, matrix] = await Promise.all([
    db.select().from(deedParties).where(eq(deedParties.deedId, id)).orderBy(asc(deedParties.id)),
    db.select().from(testimonies).where(eq(testimonies.deedId, id)).orderBy(asc(testimonies.ordinal)),
    deed.writingId ? db.select({ id: writings.id, title: writings.title }).from(writings).where(eq(writings.id, deed.writingId)) : Promise.resolve([]),
  ]);
  const pending = parties.filter((p) => !p.signedOn).length;

  return (
    <>
      <PageHeader
        title={`Escritura número ${deed.number}`}
        subtitle={`${deed.act} · ${formatDate(deed.grantedOn)}${deed.volume ? ` · tomo ${deed.volume}` : ""}`}
        actions={
          matrix[0] ? (
            <Link href={`/escritos/${matrix[0].id}`} className="btn-primary">
              Ver matriz
            </Link>
          ) : null
        }
      />
      <NotaryNav current="/notaria" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section>
            <h2 className="mb-3 font-serif text-lg font-semibold">Datos de la escritura</h2>
            <DeedForm action={updateDeedAction.bind(null, deed.id)} values={deed} submitLabel="Guardar cambios" showStatus />
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <h2 className="font-serif text-lg font-semibold">Comparecientes y firmas</h2>
              <span className={pending ? "badge-amber" : "badge-green"}>{parties.length === 0 ? "Sin comparecientes" : pending ? `${pending} sin firmar` : "Todas firmadas"}</span>
            </div>
            {parties.length === 0 ? (
              <EmptyState title="Añade quién comparece" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {parties.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink-900">{p.name}</p>
                      <p className="text-xs text-ink-500">
                        {p.role}
                        {p.idNumber ? ` · ${p.idNumber}` : ""}
                        {p.signedOn ? ` · firmó el ${formatDate(p.signedOn)}` : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-1">
                      <form action={toggleSignatureAction.bind(null, deed.id, p.id)}>
                        <button className={p.signedOn ? "btn-ghost btn-sm" : "btn-secondary btn-sm"}>{p.signedOn ? "Quitar firma" : "Marcar firmado"}</button>
                      </form>
                      <form action={deletePartyAction.bind(null, deed.id, p.id)}>
                        <ConfirmButton message={`¿Quitar a ${p.name}?`} className="btn-ghost btn-sm text-red-700">
                          Quitar
                        </ConfirmButton>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addPartyAction.bind(null, deed.id)} resetOnSuccess className="border-t border-ink-100 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Nombre" className="sm:col-span-2">
                  <input className="input" name="name" required maxLength={200} />
                </Field>
                <Field label="Cédula">
                  <input className="input" name="idNumber" maxLength={40} />
                </Field>
                <Field label="Calidad">
                  <select className="input" name="role" defaultValue="Otorgante">
                    {["Otorgante", "Poderdante", "Apoderado(a)", "Vendedor(a)", "Comprador(a)", "Testigo", "Intérprete", "Representante"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-3">
                <SubmitButton className="btn-secondary">Añadir compareciente</SubmitButton>
              </div>
            </ActionForm>
          </section>
        </div>

        <section className="card h-fit lg:col-span-2">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Testimonios</h2>
          {tests.length === 0 ? (
            <EmptyState title="Aún no se ha expedido ninguno" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {tests.map((t) => (
                <li key={t.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-ink-900">{ORD[t.ordinal - 1] ?? `${t.ordinal}.º`} testimonio</p>
                  <p className="text-xs text-ink-500">
                    {formatDate(t.issuedOn)}
                    {t.issuedTo ? ` · para ${t.issuedTo}` : ""}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addTestimonyAction.bind(null, deed.id)} resetOnSuccess className="space-y-3 border-t border-ink-100 px-5 py-4">
            <Field label="Fecha de expedición">
              <input className="input" type="date" name="issuedOn" defaultValue={todayISO()} />
            </Field>
            <Field label="Expedido para">
              <input className="input" name="issuedTo" maxLength={200} />
            </Field>
            <Field label="Observaciones">
              <input className="input" name="notes" maxLength={1000} />
            </Field>
            <SubmitButton className="btn-secondary">Registrar testimonio</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
