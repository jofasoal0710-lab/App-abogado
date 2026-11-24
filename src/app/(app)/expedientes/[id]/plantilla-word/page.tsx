import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { docTemplates } from "@/db/schema";
import { requireMatterPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { AUTO_FIELDS, AUTO_KEYS } from "@/lib/word-templates";
import { autoFieldValues, loadBarNumber, loadFillContext } from "@/lib/word-templates-db";
import { generateFromTemplateAction } from "../../../formularios/plantillas/actions";

export const metadata: Metadata = { title: "Generar desde plantilla Word" };

const LABELS = new Map(AUTO_FIELDS.map((f) => [f.key, f.label]));
const human = (key: string) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Elige una plantilla Word, revisa los datos (los automáticos ya vienen rellenos) y genera el documento. */
export default async function GenerateWordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const matter = await requireMatterPage(user, Number(id));
  const templates = await db.select({ id: docTemplates.id, name: docTemplates.name, description: docTemplates.description, fields: docTemplates.fields }).from(docTemplates).orderBy(asc(docTemplates.name));
  const t = templates.find((x) => x.id === Number(sp.t)) ?? null;
  const ctx = t ? await loadFillContext(matter.id) : null;
  const values = t && ctx ? autoFieldValues({ ...user, barNumber: await loadBarNumber(user.id) }, ctx.matter, ctx.client) : {};
  const auto = t ? t.fields.filter((f) => AUTO_KEYS.has(f)) : [];
  const custom = t ? t.fields.filter((f) => !AUTO_KEYS.has(f)) : [];
  const long = (k: string) => /direccion|descripcion|hechos|pretension|observacion|detalle/.test(k);

  return (
    <>
      <PageHeader
        title="Generar desde plantilla Word"
        subtitle={`${matter.number} · ${matter.title}`}
        actions={<Link className="btn-ghost" href={`/expedientes/${matter.id}?tab=documentos`}>← Volver</Link>}
      />
      {templates.length === 0 ? (
        <div className="card">
          <EmptyState title="Todavía no hay plantillas Word">
            Súbelas en{" "}
            <Link className="link" href="/formularios/plantillas">
              Formularios › Plantillas Word
            </Link>
            .
          </EmptyState>
        </div>
      ) : (
        <>
          <form className="card card-pad mb-6 flex flex-wrap items-end gap-3" action={`/expedientes/${matter.id}/plantilla-word`}>
            <Field label="Plantilla" className="min-w-64 flex-1">
              <select className="input" name="t" defaultValue={t?.id ?? ""} required>
                <option value="" disabled>
                  Elige una plantilla…
                </option>
                {templates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn-primary">Continuar</button>
          </form>

          {t && (
            <ActionForm action={generateFromTemplateAction.bind(null, matter.id, t.id)} className="card">
              <div className="border-b border-ink-100 px-5 py-3">
                <h2 className="font-serif text-lg font-semibold">{t.name}</h2>
                {t.description && <p className="text-sm text-ink-600">{t.description}</p>}
                <p className="text-xs text-ink-500">Revisa los datos: lo que cambies aquí solo se usa en este documento (no modifica el cliente ni el expediente).</p>
              </div>
              <div className="space-y-5 px-5 py-4">
                {custom.length > 0 && (
                  <fieldset>
                    <legend className="label">Datos para este documento</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {custom.map((f) => (
                        <Field key={f} label={human(f)} className={long(f) ? "sm:col-span-2" : undefined}>
                          {long(f) ? <textarea className="input min-h-20" name={`f_${f}`} maxLength={5000} /> : <input className="input" name={`f_${f}`} maxLength={5000} />}
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                )}
                {auto.length > 0 && (
                  <fieldset>
                    <legend className="label">Rellenados con los datos del expediente</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {auto.map((f) => (
                        <Field key={f} label={LABELS.get(f) ?? human(f)} hint={values[f] ? undefined : "Vacío en la ficha: complétalo aquí o en el cliente/expediente."}>
                          <input className="input" name={`f_${f}`} defaultValue={values[f] ?? ""} maxLength={5000} />
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                )}
                {t.fields.length === 0 && <p className="text-sm text-ink-600">Esta plantilla no tiene campos: se guardará una copia tal cual en el expediente.</p>}
                <Field label="Nombre del documento" hint={`Se añade el número del expediente (${matter.number}).`}>
                  <input className="input" name="fileName" defaultValue={t.name} maxLength={120} />
                </Field>
              </div>
              <div className="border-t border-ink-100 px-5 py-4">
                <SubmitButton pendingText="Generando…">Generar y guardar en el expediente</SubmitButton>
              </div>
            </ActionForm>
          )}
        </>
      )}
    </>
  );
}
