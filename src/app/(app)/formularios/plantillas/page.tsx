import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { docTemplates, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { AUTO_FIELDS, AUTO_KEYS } from "@/lib/word-templates";
import { deleteTemplateAction, uploadTemplateAction } from "./actions";

export const metadata: Metadata = { title: "Plantillas Word" };

/** Biblioteca de plantillas Word del despacho: subir, revisar sus campos y descargarlas. */
export default async function WordTemplatesPage() {
  const user = await requireUser();
  const manage = can(user, "plantillas.gestionar");
  const rows = await db.select({ t: docTemplates, author: users.name }).from(docTemplates).leftJoin(users, eq(users.id, docTemplates.createdById)).orderBy(desc(docTemplates.createdAt));
  const groups = [...new Set(AUTO_FIELDS.map((f) => f.group))];

  return (
    <>
      <PageHeader
        title="Plantillas Word"
        subtitle="Tus propios modelos (.docx) con campos entre llaves. Desde cualquier expediente se generan rellenados y se guardan en sus documentos."
        actions={<Link href="/formularios" className="btn-ghost">← Formularios</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Plantillas del despacho</h2>
          {rows.length === 0 ? (
            <EmptyState title="Todavía no hay plantillas">{manage ? "Sube tu primer modelo de Word con campos como {cliente} o {expediente}." : "Pide a un abogado o administrador que suba los modelos del despacho."}</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-100">
              {rows.map(({ t, author }) => {
                const custom = t.fields.filter((f) => !AUTO_KEYS.has(f));
                return (
                  <li key={t.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{t.name}</p>
                        {t.description && <p className="text-sm text-ink-600">{t.description}</p>}
                        <p className="text-xs text-ink-500">
                          {t.fileName} · {Math.max(1, Math.round(t.sizeBytes / 1024))} KB · {author ?? "—"} · {formatDate(t.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <a className="btn-ghost btn-sm" href={`/api/plantillas/${t.id}`}>
                          Descargar
                        </a>
                        {manage && (
                          <form action={deleteTemplateAction.bind(null, t.id)}>
                            <ConfirmButton message={`¿Eliminar la plantilla «${t.name}»? Los documentos ya generados no se borran.`} className="btn-ghost btn-sm text-red-700">
                              Eliminar
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 flex flex-wrap gap-1">
                      {t.fields.length === 0 && <span className="text-xs text-ink-500">Sin campos.</span>}
                      {t.fields.map((f) => (
                        <code key={f} className={`rounded px-1.5 py-0.5 text-xs ${AUTO_KEYS.has(f) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} title={AUTO_KEYS.has(f) ? "Se rellena solo" : "Se pide al generar"}>
                          {`{${f}}`}
                        </code>
                      ))}
                    </p>
                    {custom.length > 0 && <p className="mt-1 text-xs text-ink-500">Los campos en ámbar se piden al generar el documento.</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {manage && (
            <ActionForm action={uploadTemplateAction} resetOnSuccess className="space-y-3 border-t border-ink-100 px-5 py-4">
              <h3 className="font-semibold">Subir una plantilla</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Archivo Word (.docx, máx. 5 MB)">
                  <input className="input" type="file" name="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
                </Field>
                <Field label="Nombre (opcional)">
                  <input className="input" name="name" maxLength={150} placeholder="Poder especial judicial" />
                </Field>
                <Field label="Descripción (opcional)" className="sm:col-span-2">
                  <input className="input" name="description" maxLength={500} placeholder="Para qué sirve y cuándo usarla" />
                </Field>
              </div>
              <SubmitButton>Subir plantilla</SubmitButton>
            </ActionForm>
          )}
        </section>

        <aside className="card card-pad h-fit">
          <h2 className="font-serif text-lg font-semibold">Cómo preparar el Word</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li>Escribe tu modelo en Word como siempre.</li>
            <li>
              Donde va un dato, escribe su campo entre llaves, p. ej. <code>{"{cliente}"}</code>.
            </li>
            <li>
              Puedes inventar campos propios (<code>{"{monto_reclamado}"}</code>): se pedirán al generar. Solo letras, números y guion bajo.
            </li>
            <li>Guárdalo como .docx y súbelo aquí.</li>
          </ol>
          <a className="btn-secondary btn-sm mt-3" href="/plantilla-ejemplo-poder.docx" download>
            Descargar una plantilla de ejemplo
          </a>
          <h3 className="label mt-4">Campos que se rellenan solos</h3>
          {groups.map((g) => (
            <div key={g} className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{g}</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {AUTO_FIELDS.filter((f) => f.group === g).map((f) => (
                  <li key={f.key}>
                    <code className="rounded bg-ink-100 px-1 text-xs">{`{${f.key}}`}</code> <span className="text-ink-600">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
