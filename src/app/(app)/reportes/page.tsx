import type { Metadata } from "next";
import { Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { AGING_BUCKETS, AGING_LABELS, fmtHours, pct, PERIOD_PRESETS, resolvePeriod } from "@/lib/report-calc";
import Link from "next/link";
import { aging, billing, collections, fundsInCustody, hoursByPerson, mattersByArea, profitabilityByArea } from "@/lib/reports";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Reportes" };

type SP = { periodo?: string; desde?: string; hasta?: string };

function Bar({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "amber" | "red" }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const color = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-brand-600";
  return (
    <span className="block h-2 w-full rounded-full bg-ink-100" aria-hidden>
      {value > 0 && <span className={`block h-2 rounded-full ${color}`} style={{ width: `${w}%` }} />}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card card-pad">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function Section({ id, title, subtitle, csv, children }: { id: string; title: string; subtitle?: string; csv?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card mb-6 break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-ink-600">{subtitle}</p>}
        </div>
        {csv && (
          <a className="no-print btn-secondary btn-sm" href={csv}>
            Descargar CSV (Excel)
          </a>
        )}
      </div>
      <div className="overflow-x-auto px-5 py-4">{children}</div>
    </section>
  );
}

const Empty = () => <p className="text-sm text-ink-500">Sin datos en este periodo.</p>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const p = resolvePeriod({ preset: sp.periodo, from: sp.desde, to: sp.hasta }, today);
  const full = can(user, "reportes.ver");
  const q = `desde=${p.from}&hasta=${p.to}`;

  const hours = await hoursByPerson(user, p, full ? undefined : user.id);
  const [bill, cash, cartera, areas, profit, funds] = full
    ? await Promise.all([billing(user, p, today), collections(user, p), aging(user, today), mattersByArea(user, p), profitabilityByArea(user, p, today), fundsInCustody(user)])
    : [null, null, null, null, null, null];

  const totalMin = hours.reduce((s, h) => s + h.minutes, 0);
  const billMin = hours.reduce((s, h) => s + h.billableMinutes, 0);
  const maxMin = Math.max(0, ...hours.map((h) => h.minutes));

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle={`Periodo: ${p.label}. ${full ? "Solo cuentan los expedientes a los que tienes acceso." : "Ves tus propias horas; los reportes del despacho requieren el permiso «Ver reportes y estadísticas»."}`}
        actions={<PrintButton />}
      />

      <form className="no-print card card-pad mb-6 grid gap-3 sm:grid-cols-4" action="/reportes">
        <Field label="Periodo">
          <select className="input" name="periodo" defaultValue={p.key}>
            {p.key === "personalizado" && <option value="personalizado">Personalizado (fechas)</option>}
            {Object.entries(PERIOD_PRESETS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="O desde">
          <input className="input" type="date" name="desde" defaultValue={p.key === "personalizado" ? p.from : ""} />
        </Field>
        <Field label="hasta">
          <input className="input" type="date" name="hasta" defaultValue={p.key === "personalizado" ? p.to : ""} />
        </Field>
        <div className="self-end">
          <button className="btn-primary w-full">Ver reporte</button>
        </div>
      </form>

      {full && bill && cash && cartera && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Facturado" value={formatMoney(bill.invoicedCents)} hint={`${bill.count} ${bill.count === 1 ? "factura emitida" : "facturas emitidas"} (neto de rectificativas)`} />
          <Kpi label="Cobrado" value={formatMoney(cash.cents)} hint={`${cash.count} ${cash.count === 1 ? "cobro recibido" : "cobros recibidos"} en el periodo`} />
          <Kpi label="Pendiente de cobro hoy" value={formatMoney(cartera.totalCents)} hint={`${cartera.invoices} ${cartera.invoices === 1 ? "factura" : "facturas"}; vencido: ${formatMoney(cartera.totalCents - cartera.totals.al_dia)}`} />
          <Kpi label="Horas registradas" value={fmtHours(totalMin)} hint={`${pct(billMin, totalMin)} % facturables`} />
        </div>
      )}

      <Section id="horas" title={full ? "Horas por persona" : "Mis horas"} subtitle="Total, facturables, ya facturadas y valor de las facturables según la tarifa de cada registro." csv={`/api/reportes?tipo=horas&${q}`}>
        {hours.length ? (
          <table className="table w-full text-sm">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="w-1/3">Horas</th>
                <th className="text-right">Total</th>
                <th className="text-right">Facturables</th>
                <th className="text-right">Facturadas</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.userId}>
                  <td>{h.name}</td>
                  <td>
                    <Bar value={h.minutes} max={maxMin} />
                  </td>
                  <td className="text-right tabular-nums">{fmtHours(h.minutes)}</td>
                  <td className="text-right tabular-nums">
                    {fmtHours(h.billableMinutes)} <span className="text-ink-500">({pct(h.billableMinutes, h.minutes)} %)</span>
                  </td>
                  <td className="text-right tabular-nums">{fmtHours(h.invoicedMinutes)}</td>
                  <td className="text-right tabular-nums">{formatMoney(h.valueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty />
        )}
      </Section>

      {full && bill && cartera && areas && profit && (
        <>
          <Section id="clientes" title="Facturación por cliente" subtitle="Facturas emitidas en el periodo: neto facturado, cobrado sobre ellas y lo que aún deben." csv={`/api/reportes?tipo=clientes&${q}`}>
            {bill.byClient.length ? (
              <table className="table w-full text-sm">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="w-1/4">Facturado</th>
                    <th className="text-right">Facturas</th>
                    <th className="text-right">Facturado</th>
                    <th className="text-right">Cobrado</th>
                    <th className="text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.byClient.slice(0, 25).map((c) => (
                    <tr key={c.key}>
                      <td>{c.key}</td>
                      <td>
                        <Bar value={c.invoiced} max={bill.byClient[0].invoiced} />
                      </td>
                      <td className="text-right tabular-nums">{c.count}</td>
                      <td className="text-right tabular-nums">{formatMoney(c.invoiced)}</td>
                      <td className="text-right tabular-nums">{formatMoney(c.paid)}</td>
                      <td className="text-right tabular-nums">{formatMoney(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
            {bill.byClient.length > 25 && <p className="mt-2 text-xs text-ink-500">Se muestran los 25 primeros; el CSV los incluye todos.</p>}
          </Section>

          <Section id="cartera" title="Cartera pendiente por antigüedad" subtitle="Todo lo que se debe hoy, según los días transcurridos desde el vencimiento (o la emisión, si no tiene vencimiento)." csv={`/api/reportes?tipo=cartera&${q}`}>
            {cartera.rows.length ? (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-5">
                  {AGING_BUCKETS.map((b) => (
                    <div key={b} className="rounded-md border border-ink-100 p-3">
                      <p className="text-xs text-ink-500">{AGING_LABELS[b]}</p>
                      <p className={`font-semibold tabular-nums ${b === "d90" || b === "d61_90" ? "text-red-700" : ""}`}>{formatMoney(cartera.totals[b])}</p>
                      <Bar value={cartera.totals[b]} max={cartera.totalCents} tone={b === "al_dia" ? "brand" : b === "d1_30" || b === "d31_60" ? "amber" : "red"} />
                    </div>
                  ))}
                </div>
                <table className="table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      {AGING_BUCKETS.map((b) => (
                        <th key={b} className="text-right">
                          {AGING_LABELS[b]}
                        </th>
                      ))}
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartera.rows.map((r) => (
                      <tr key={r.client}>
                        <td>
                          {r.client}
                          {r.oldestDays > 90 && <span className="badge-red ml-2">{r.oldestDays} días</span>}
                        </td>
                        {AGING_BUCKETS.map((b) => (
                          <td key={b} className="text-right tabular-nums">
                            {r[b] ? formatMoney(r[b]) : "—"}
                          </td>
                        ))}
                        <td className="text-right font-semibold tabular-nums">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-ink-500">No hay nada pendiente de cobro.</p>
            )}
          </Section>

          <Section id="rentabilidad" title="Rentabilidad por materia" subtitle="Valor de las horas facturables trabajadas, lo facturado y los gastos del periodo. Realización = facturado ÷ valor de las horas." csv={`/api/reportes?tipo=materias&${q}`}>
            {profit.length ? (
              <table className="table w-full text-sm">
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th className="text-right">Horas</th>
                    <th className="text-right">Valor de horas</th>
                    <th className="text-right">Facturado</th>
                    <th className="text-right">Gastos</th>
                    <th className="text-right">Realización</th>
                  </tr>
                </thead>
                <tbody>
                  {profit.map((a) => (
                    <tr key={a.area}>
                      <td>{a.area}</td>
                      <td className="text-right tabular-nums">{fmtHours(a.minutes)}</td>
                      <td className="text-right tabular-nums">{formatMoney(a.hoursValueCents)}</td>
                      <td className="text-right tabular-nums">{formatMoney(a.invoicedCents)}</td>
                      <td className="text-right tabular-nums">{formatMoney(a.expensesCents)}</td>
                      <td className="text-right tabular-nums">{a.hoursValueCents ? `${pct(a.invoicedCents, a.hoursValueCents)} %` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
          </Section>

          <Section id="expedientes" title="Expedientes por materia" subtitle="Activos hoy, abiertos y cerrados en el periodo." csv={`/api/reportes?tipo=expedientes&${q}`}>
            {areas.length ? (
              <table className="table w-full text-sm">
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th className="w-1/3">Activos</th>
                    <th className="text-right">Activos</th>
                    <th className="text-right">Abiertos</th>
                    <th className="text-right">Cerrados</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.key}>
                      <td>{a.key}</td>
                      <td>
                        <Bar value={a.active} max={areas[0].active} />
                      </td>
                      <td className="text-right tabular-nums">{a.active}</td>
                      <td className="text-right tabular-nums">{a.opened}</td>
                      <td className="text-right tabular-nums">{a.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
          </Section>

          {funds && (
            <Section id="provisiones" title="Provisiones de fondos en custodia" subtitle={`Dinero de clientes que el despacho tiene hoy a cuenta de gastos y honorarios: ${formatMoney(funds.totalCents)}${funds.low ? ` · ${funds.low} con saldo bajo` : ""}.`}>
              {funds.rows.length ? (
                <table className="table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Expediente</th>
                      <th>Cliente</th>
                      <th className="text-right">Saldo</th>
                      <th className="text-right">Mínimo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {funds.rows.map((f) => (
                      <tr key={f.matterId}>
                        <td>
                          <Link className="link" href={`/expedientes/${f.matterId}?tab=cobro#provision`}>
                            {f.number}
                          </Link>{" "}
                          <span className="text-ink-500">{f.title}</span>
                        </td>
                        <td>{f.client}</td>
                        <td className="text-right tabular-nums">{formatMoney(f.balanceCents)}</td>
                        <td className="text-right tabular-nums">{f.minCents != null ? formatMoney(f.minCents) : "—"}</td>
                        <td>{f.low ? <span className="badge-amber">Saldo bajo</span> : f.balanceCents <= 0 ? <span className="badge-gray">Agotada</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-ink-500">Ningún expediente tiene provisión de fondos.</p>
              )}
            </Section>
          )}
        </>
      )}
    </>
  );
}
