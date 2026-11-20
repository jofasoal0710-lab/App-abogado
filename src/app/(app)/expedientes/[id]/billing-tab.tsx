import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field } from "@/components/ui";
import { db } from "@/db";
import { feeServices, invoices, matterExpenses, matterFeeStages, timeEntries, type Matter } from "@/db/schema";
import { arancelItem, arancelMinimum, timbreColegio } from "@/lib/arancel";
import { todayISO, formatDate } from "@/lib/dates";
import { FEE_MODE_LABELS, profitability, stagesToText, suggestFee } from "@/lib/fees";
import { billingTypeLabels, entries, expenseKindLabels } from "@/lib/labels";
import { formatDuration, formatMoney } from "@/lib/money";
import { getFeeSettings, toGuideService } from "@/lib/tariff";
import { addExpenseAction, deleteExpenseAction, setStagesAction, toggleExpenseAction } from "../billing-actions";

/** Pestaña «Cobro»: cómo se cobra, etapas, rendimiento por hora y gastos (aparte de los honorarios). */
export async function BillingTab({ matter, canEmit, defaultRateCents }: { matter: Matter; canEmit: boolean; defaultRateCents: number }) {
  const [service, stages, expenses, hours, settings] = await Promise.all([
    matter.serviceId ? db.select().from(feeServices).where(eq(feeServices.id, matter.serviceId)).then((r) => r[0] ?? null) : null,
    db
      .select({ id: matterFeeStages.id, name: matterFeeStages.name, amountCents: matterFeeStages.amountCents, invoiceId: matterFeeStages.invoiceId, number: invoices.number })
      .from(matterFeeStages)
      .leftJoin(invoices, eq(invoices.id, matterFeeStages.invoiceId))
      .where(eq(matterFeeStages.matterId, matter.id))
      .orderBy(asc(matterFeeStages.position)),
    db.select().from(matterExpenses).where(eq(matterExpenses.matterId, matter.id)).orderBy(asc(matterExpenses.spentOn), asc(matterExpenses.id)),
    db
      .select({
        minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int`,
        cents: sql<number>`coalesce(sum(round(${timeEntries.minutes} * ${timeEntries.rateCents} / 60.0)), 0)::float8`,
      })
      .from(timeEntries)
      .where(and(eq(timeEntries.matterId, matter.id))),
    getFeeSettings(),
  ]);
  const h = hours[0];
  const perProcess = matter.billingType === "tarifa_fija";
  const fee = matter.fixedFeeCents ?? 0;
  const sug = service ? suggestFee(toGuideService(service), matter.feeBaseCents, settings.arancelAdjustBp) : null;
  const ref = arancelItem(service?.arancelKey);
  const arancel = ref ? arancelMinimum(ref, matter.feeBaseCents, settings.arancelAdjustBp) : null;
  const hourMin = arancelMinimum(arancelItem("hora")!, null, settings.arancelAdjustBp).minCents!;
  const below = perProcess && arancel?.minCents != null && !arancel.perHour && (!arancel.needsBase || (matter.feeBaseCents ?? 0) > 0) && fee < arancel.minCents;
  const prof = perProcess && fee ? profitability(fee, h.minutes, h.cents) : null;
  const billedStages = stages.filter((s) => s.invoiceId !== null);
  const pendingExpenses = expenses.filter((e) => !e.reimbursedAt).reduce((s, e) => s + e.amountCents, 0);
  const timbre = matter.feeBaseCents ? timbreColegio(matter.feeBaseCents) : null;
  const stageText = stages.length && fee ? stagesToText(stages.map((s) => ({ name: s.name, percent: Math.round((s.amountCents / fee) * 10000) / 100 }))) : stagesToText(service?.stages ?? []);

  return (
    <div className="space-y-6">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">Cómo se cobra</h2>
            <p className="text-sm text-ink-600">
              {billingTypeLabels[matter.billingType]}
              {service && ` · ${service.name} (${FEE_MODE_LABELS[service.mode].toLowerCase()})`}
            </p>
          </div>
          <Link href={`/expedientes/${matter.id}/editar`} className="btn-secondary btn-sm">
            Cambiar
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {perProcess ? (
            <Item label="Honorarios pactados" value={formatMoney(fee)} />
          ) : (
            <Item label="Tarifa por hora" value={`${formatMoney(matter.hourlyRateCents ?? defaultRateCents)}${matter.hourlyRateCents ? " (de este expediente)" : " (la de cada abogado)"}`} />
          )}
          {matter.feeBaseCents ? <Item label="Cuantía o valor del acto" value={formatMoney(matter.feeBaseCents)} /> : null}
          {sug && <Item label="Sugerido por el tarifario" value={sug.amountCents != null ? `${formatMoney(sug.amountCents)}${sug.perHour ? "/h" : ""}` : "—"} hint={sug.explanation} />}
          {arancel && <Item label={`Mínimo del arancel (${ref!.article})`} value={arancel.minCents != null && (!arancel.needsBase || matter.feeBaseCents) ? `${formatMoney(arancel.minCents)}${arancel.perHour ? "/h" : ""}` : "—"} hint={arancel.explanation} />}
          {!perProcess && <Item label="Mínimo del arancel por hora" value={formatMoney(hourMin)} hint="Art. 7: la hora profesional no puede ser menor." />}
        </dl>
        {below && (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Los honorarios pactados son inferiores al mínimo del arancel. Revísalos o deja constancia de la causa.
          </p>
        )}
        {!perProcess && (matter.hourlyRateCents ?? defaultRateCents) < hourMin && (matter.hourlyRateCents ?? defaultRateCents) > 0 && (
          <p role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La tarifa por hora es inferior al mínimo del arancel ({formatMoney(hourMin)}).
          </p>
        )}
      </section>

      {perProcess && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">Etapas de cobro</h2>
            {canEmit && stages.some((s) => s.invoiceId === null) && (
              <Link href={`/facturas/nueva?expediente=${matter.id}`} className="btn-primary btn-sm">
                Facturar una etapa
              </Link>
            )}
          </div>
          {stages.length === 0 ? (
            <EmptyState title="Un solo pago">Los honorarios se facturan de una vez. Puedes repartirlos en etapas (p. ej. un tercio con la demanda).</EmptyState>
          ) : (
            <table className="table">
              <tbody>
                {stages.map((s, i) => (
                  <tr key={s.id}>
                    <td className="w-px text-ink-500">{i + 1}</td>
                    <td>{s.name}</td>
                    <td className="text-right tabular-nums">{formatMoney(s.amountCents)}</td>
                    <td className="text-right">
                      {s.invoiceId ? (
                        <Link className="badge-green" href={`/facturas/${s.invoiceId}`}>
                          Facturada {s.number ?? "(borrador)"}
                        </Link>
                      ) : (
                        <span className="badge-amber">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canEmit && billedStages.length === 0 && fee > 0 && (
            <ActionForm action={setStagesAction.bind(null, matter.id)} className="border-t border-ink-100 px-5 py-4">
              <Field label="Repartir en etapas" hint="Una por línea: nombre y porcentaje (suman 100). Vacío = un solo pago. El arancel fija, salvo convenio, p. ej. tercios en procesos civiles (art. 18).">
                <textarea className="input min-h-24" name="stages" defaultValue={stageText} placeholder={"Presentación de la demanda 33,34\nFase demostrativa 33,33\nSentencia 33,33"} />
              </Field>
              <div className="mt-2">
                <SubmitButton>Guardar etapas</SubmitButton>
              </div>
            </ActionForm>
          )}
        </section>
      )}

      {prof && (
        <section className="card card-pad">
          <h2 className="font-serif text-lg font-semibold">¿Rinde el precio?</h2>
          <p className="text-sm text-ink-600">Las horas registradas en este expediente, aunque se cobre por proceso, sirven para saber cuánto se gana por hora.</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Horas registradas" value={formatDuration(h.minutes)} />
            <Item label="Valor de esas horas" value={formatMoney(h.cents)} />
            <Item label="Ganancia por hora efectiva" value={prof.perHourCents != null ? `${formatMoney(prof.perHourCents)}/h` : "—"} hint={prof.perHourCents != null && prof.perHourCents < hourMin ? `Menos que la hora del arancel (${formatMoney(hourMin)})` : undefined} />
            <Item label={prof.diffCents >= 0 ? "Por encima del valor de las horas" : "Por debajo del valor de las horas"} value={formatMoney(Math.abs(prof.diffCents))} />
          </dl>
        </section>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
          <div>
            <h2 className="font-serif text-lg font-semibold">Gastos, timbres y derechos de registro</h2>
            <p className="text-xs text-ink-500">No son honorarios ni llevan IVA: se cobran aparte al cliente.</p>
          </div>
          <p className="text-sm">
            Pendiente de reembolso: <strong className="tabular-nums">{formatMoney(pendingExpenses)}</strong>
          </p>
        </div>
        {expenses.length === 0 ? (
          <EmptyState title="Sin gastos registrados" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th className="text-right">Importe</th>
                <th>Estado</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDate(e.spentOn)}</td>
                  <td>
                    {e.description}
                    <span className="block text-xs text-ink-500">{expenseKindLabels[e.kind]}</span>
                  </td>
                  <td className="text-right tabular-nums">{formatMoney(e.amountCents)}</td>
                  <td>{e.reimbursedAt ? <span className="badge-green">Reembolsado {formatDate(e.reimbursedAt)}</span> : <span className="badge-amber">Pendiente</span>}</td>
                  <td className="whitespace-nowrap">
                    <form action={toggleExpenseAction.bind(null, e.id, matter.id)} className="inline">
                      <button className="btn-ghost btn-sm">{e.reimbursedAt ? "Marcar pendiente" : "Marcar reembolsado"}</button>
                    </form>
                    <form action={deleteExpenseAction.bind(null, e.id, matter.id)} className="inline">
                      <ConfirmButton message={`¿Borrar «${e.description}»?`} className="btn-ghost btn-sm text-red-700">
                        Borrar
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ActionForm action={addExpenseAction.bind(null, matter.id)} resetOnSuccess className="grid gap-3 border-t border-ink-100 px-5 py-4 sm:grid-cols-6 sm:items-end">
          <Field label="Tipo" className="sm:col-span-1">
            <select className="input" name="kind" defaultValue="timbre">
              {entries(expenseKindLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Concepto" className="sm:col-span-2">
            <input className="input" name="description" required maxLength={300} placeholder="Timbre del Colegio, derechos del Registro…" />
          </Field>
          <Field label="Importe (₡)" className="sm:col-span-1">
            <input className="input" name="amount" required inputMode="decimal" />
          </Field>
          <Field label="Fecha" className="sm:col-span-1">
            <input className="input" type="date" name="spentOn" defaultValue={todayISO()} />
          </Field>
          <div className="sm:col-span-1">
            <SubmitButton>Añadir gasto</SubmitButton>
          </div>
          {timbre != null && (
            <p className="text-xs text-ink-500 sm:col-span-6">
              Timbre del Colegio de Abogados para una cuantía de {formatMoney(matter.feeBaseCents!)}: {timbre ? formatMoney(timbre) : "exento"} (arts. 107 y 108 del arancel).
            </p>
          )}
        </ActionForm>
      </section>
    </div>
  );
}

function Item({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-ink-800">{value || "—"}</dd>
      {hint && <dd className="text-xs text-ink-500">{hint}</dd>}
    </div>
  );
}
