import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { canUserIdAccessMatter, requireMatterPage } from "@/lib/access";
import { eventFormOptions } from "@/lib/agenda-data";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { PROCESS_TEMPLATES, TEMPLATE_AREAS, getTemplate, planTemplate } from "@/lib/process-templates";
import { applyTemplateAction } from "../../plantilla-actions";

export const metadata: Metadata = { title: "Plantilla de proceso" };

/**
 * Aplica una plantilla de proceso al expediente: primero se elige la plantilla y la fecha base (la de la
 * notificación), luego se revisan y corrigen los pasos propuestos y se crean todos de una vez.
 */
export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; base?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const matter = await requireMatterPage(user, Number(id));
  const today = todayISO();
  const t = sp.t ? getTemplate(sp.t) : null;
  const base = sp.base && /^\d{4}-\d{2}-\d{2}$/.test(sp.base) ? sp.base : null;
  const plan = t && base ? planTemplate(t, base, today) : null;
  const options = plan ? await eventFormOptions(user) : null;
  const assignable = options ? (await Promise.all(options.users.map(async (u) => ((await canUserIdAccessMatter(u.id, matter.id)) ? u : null)))).filter((u) => u !== null) : [];

  return (
    <>
      <PageHeader title="Aplicar plantilla de proceso" subtitle={`${matter.number} · ${matter.title}`} actions={<Link className="btn-ghost" href={`/expedientes/${matter.id}?tab=agenda`}>← Volver</Link>} />

      <form className="card card-pad mb-6 grid gap-3 sm:grid-cols-3" action={`/expedientes/${matter.id}/plantilla`}>
        <Field label="Plantilla" className="sm:col-span-2">
          <select className="input" name="t" defaultValue={t?.key ?? ""} required>
            <option value="" disabled>
              Elige el trámite…
            </option>
            {Object.entries(TEMPLATE_AREAS).map(([area, label]) => (
              <optgroup key={area} label={label}>
                {PROCESS_TEMPLATES.filter((x) => x.area === area).map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label={t?.baseLabel ?? "Fecha de notificación"}>
          <input className="input" type="date" name="base" defaultValue={base ?? today} required />
        </Field>
        <div className="sm:col-span-3">
          <button className="btn-primary">Ver los pasos</button>
        </div>
      </form>

      {t && plan && base && (
        <ActionForm action={applyTemplateAction.bind(null, matter.id)} className="card">
          <input type="hidden" name="template" value={t.key} />
          <input type="hidden" name="base" value={base} />
          <div className="border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">{t.name}</h2>
            <p className="text-sm text-ink-600">
              {t.baseLabel}: {formatDate(base)}. Los plazos se cuentan en días hábiles desde el día siguiente, sin fines de semana ni feriados de Costa Rica. Revisa y corrige antes de crear.
            </p>
          </div>
          <ol className="divide-y divide-ink-100">
            {plan.map((s) => (
              <li key={s.index} className={`grid gap-2 px-5 py-3 sm:grid-cols-[auto_1fr_11rem] sm:items-start ${s.type === "plazo" ? "bg-amber-50/50" : ""}`}>
                <label className="flex items-center gap-2 sm:pt-7">
                  <input type="checkbox" name={`inc_${s.index}`} defaultChecked aria-label={`Crear «${s.title}»`} />
                  <span className={s.type === "plazo" ? "badge-red" : "badge-gray"}>{s.type === "plazo" ? "Plazo" : "Tarea"}</span>
                </label>
                <div>
                  <span className="label">Paso {s.index + 1}</span>
                  <input className="input" name={`title_${s.index}`} defaultValue={s.title} maxLength={250} aria-label={`Título del paso ${s.index + 1}`} />
                  {s.note && <span className="mt-1 block text-xs text-ink-500">{s.note}</span>}
                  {s.past && <span className="mt-1 block text-xs font-medium text-red-700">¡Este plazo ya venció!</span>}
                  <input type="hidden" name={`note_${s.index}`} value={s.ref ? `Fundamento: ${s.ref}.` : ""} />
                </div>
                <div>
                  <span className="label">Fecha</span>
                  <input className="input" type="date" name={`date_${s.index}`} defaultValue={s.date} aria-label={`Fecha del paso ${s.index + 1}`} />
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 px-5 py-4">
            <Field label="Responsable">
              <select className="input" name="assignedId" defaultValue={String(user.id)}>
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton pendingText="Creando…">Crear los pasos marcados</SubmitButton>
          </div>
        </ActionForm>
      )}
    </>
  );
}
