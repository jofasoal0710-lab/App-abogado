import type { Metadata } from "next";
import Link from "next/link";
import { Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { laborSettlement, procedureDeadline } from "@/lib/calculators";
import { holidayName } from "@/lib/cr-holidays";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney, parseMoneyToCents } from "@/lib/money";

export const metadata: Metadata = { title: "Herramientas" };

type SP = Record<string, string | undefined>;
const isoOk = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const colones = (n: number) => formatMoney(Math.round(n * 100));

/** Calculadoras: liquidación laboral y vencimiento de plazos procesales. */
export default async function ToolsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayISO();

  // Liquidación
  let settlement: ReturnType<typeof laborSettlement> | null = null;
  let settlementError: string | null = null;
  if (sp.calc === "liquidacion") {
    const salary = parseMoneyToCents(sp.salario ?? "");
    const vac = sp.vacaciones?.trim() ? Number(sp.vacaciones.replace(",", ".")) : undefined;
    const ag = sp.aguinaldo?.trim() ? parseMoneyToCents(sp.aguinaldo) : undefined;
    if (!isoOk(sp.ingreso) || !isoOk(sp.salida) || sp.ingreso! >= sp.salida!) settlementError = "Revisa las fechas de ingreso y salida.";
    else if (!salary || salary <= 0) settlementError = "Indica el salario promedio mensual de los últimos seis meses.";
    else if (vac !== undefined && (!Number.isFinite(vac) || vac < 0 || vac > 365)) settlementError = "Los días de vacaciones no son válidos.";
    else
      settlement = laborSettlement({
        start: sp.ingreso!,
        end: sp.salida!,
        avgMonthlySalary: salary / 100,
        withoutJustCause: sp.causa !== "justa",
        noticeGiven: sp.preaviso === "si",
        pendingVacationDays: vac,
        aguinaldoBase: ag ? ag / 100 : undefined,
      });
  }

  // Plazo
  let deadline: ReturnType<typeof procedureDeadline> | null = null;
  let deadlineError: string | null = null;
  if (sp.calc === "plazo") {
    const n = Number(sp.cantidad);
    const unit = sp.unidad === "meses" || sp.unidad === "anos" ? sp.unidad : "dias";
    if (!isoOk(sp.notificado)) deadlineError = "Indica la fecha de notificación.";
    else if (!Number.isInteger(n) || n < 1 || n > (unit === "dias" ? 365 : 60)) deadlineError = "La duración del plazo no es válida.";
    else {
      const closed: string[] = [];
      if (sp.cierre === "si") {
        // Cierre colectivo de fin de año del Poder Judicial (fechas orientativas: confírmalas cada año).
        for (const y of [Number(sp.notificado!.slice(0, 4)), Number(sp.notificado!.slice(0, 4)) + 1])
          for (const d of [`${y - 1}-12-24`, `${y - 1}-12-26`, `${y - 1}-12-27`, `${y - 1}-12-28`, `${y - 1}-12-29`, `${y - 1}-12-30`, `${y - 1}-12-31`, `${y}-01-02`]) closed.push(d);
      }
      deadline = procedureDeadline({ notified: sp.notificado!, amount: n, unit, closedDays: closed });
    }
  }

  return (
    <>
      <PageHeader title="Herramientas" subtitle="Cálculos con la ley costarricense. Son orientativos: revisa cada caso." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section id="liquidacion" className="card card-pad">
          <h2 className="mb-1 font-serif text-lg font-semibold">Liquidación laboral</h2>
          <p className="mb-4 text-sm text-ink-600">Preaviso (art. 28), cesantía (art. 29), vacaciones (arts. 153 y 156) y aguinaldo (Ley 2412). Salario diario = promedio de 6 meses ÷ 30 (art. 30).</p>
          <form className="grid gap-3 sm:grid-cols-2" action="/herramientas#liquidacion">
            <input type="hidden" name="calc" value="liquidacion" />
            <Field label="Fecha de ingreso">
              <input className="input" type="date" name="ingreso" defaultValue={sp.ingreso ?? ""} required />
            </Field>
            <Field label="Fecha de salida">
              <input className="input" type="date" name="salida" defaultValue={sp.salida ?? today} required />
            </Field>
            <Field label="Salario promedio mensual (últimos 6 meses)">
              <input className="input" name="salario" inputMode="decimal" defaultValue={sp.salario ?? ""} required />
            </Field>
            <Field label="Motivo de salida">
              <select className="input" name="causa" defaultValue={sp.causa ?? "sin"}>
                <option value="sin">Despido sin justa causa (o causa ajena al trabajador)</option>
                <option value="justa">Renuncia o despido con justa causa</option>
              </select>
            </Field>
            <Field label="¿Se dio el preaviso trabajado?">
              <select className="input" name="preaviso" defaultValue={sp.preaviso ?? "no"}>
                <option value="no">No (se paga)</option>
                <option value="si">Sí</option>
              </select>
            </Field>
            <Field label="Días de vacaciones pendientes" hint="Vacío: se estima 1 día por mes desde el último aniversario">
              <input className="input" name="vacaciones" inputMode="decimal" defaultValue={sp.vacaciones ?? ""} />
            </Field>
            <Field label="Salarios desde el 1 de diciembre (aguinaldo)" hint="Vacío: se estima con el promedio" className="sm:col-span-2">
              <input className="input" name="aguinaldo" inputMode="decimal" defaultValue={sp.aguinaldo ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn-primary">Calcular liquidación</button>
            </div>
          </form>
          {settlementError && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{settlementError}</p>}
          {settlement && (
            <div className="mt-5" aria-live="polite">
              <p className="text-sm text-ink-700">
                Antigüedad: <strong>{settlement.years} años, {settlement.months} meses y {settlement.days} días</strong> · Salario diario: <strong>{colones(settlement.dailySalary)}</strong>
              </p>
              <table className="table mt-3">
                <tbody>
                  {settlement.lines.map((l) => (
                    <tr key={l.concept}>
                      <td>
                        <span className="font-medium">{l.concept}</span>
                        {l.days !== null && <span className="text-ink-500"> · {String(l.days).replace(".", ",")} días</span>}
                        <span className="block text-xs text-ink-500">{l.basis}</span>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">{colones(l.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-semibold">Total estimado</td>
                    <td className="whitespace-nowrap text-right font-semibold tabular-nums">{colones(settlement.total)}</td>
                  </tr>
                </tbody>
              </table>
              <ul className="mt-2 list-disc pl-5 text-xs text-ink-500">
                {settlement.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                <Link className="link" href="/normativa/ley-2?q=28 y 29">
                  Ver los artículos 28 y 29 del Código de Trabajo
                </Link>
              </p>
            </div>
          )}
        </section>

        <section id="plazo" className="card card-pad">
          <h2 className="mb-1 font-serif text-lg font-semibold">Vencimiento de un plazo procesal</h2>
          <p className="mb-4 text-sm text-ink-600">Según el art. 30.5 del Código Procesal Civil: corre desde el día hábil siguiente a la notificación; por días, solo hábiles; por meses o años, de fecha a fecha; si vence en día inhábil, pasa al siguiente hábil. Con los feriados de Costa Rica.</p>
          <form className="grid gap-3 sm:grid-cols-3" action="/herramientas#plazo">
            <input type="hidden" name="calc" value="plazo" />
            <Field label="Notificado el">
              <input className="input" type="date" name="notificado" defaultValue={sp.notificado ?? today} required />
            </Field>
            <Field label="Plazo">
              <input className="input" name="cantidad" inputMode="numeric" defaultValue={sp.cantidad ?? "3"} required />
            </Field>
            <Field label="En">
              <select className="input" name="unidad" defaultValue={sp.unidad ?? "dias"}>
                <option value="dias">días hábiles</option>
                <option value="meses">meses</option>
                <option value="anos">años</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-3">
              <input type="checkbox" name="cierre" value="si" defaultChecked={sp.cierre === "si"} />
              Excluir el cierre colectivo de fin de año del Poder Judicial (24 dic – 2 ene, orientativo)
            </label>
            <div className="sm:col-span-3">
              <button className="btn-primary">Calcular vencimiento</button>
            </div>
          </form>
          <p className="mt-2 text-xs text-ink-500">Plazos frecuentes (CPC): revocatoria 3 días (art. 66.1) · apelación de autos 3 y de sentencias 5 (art. 67) · casación 15 (art. 69.3) · contestar ordinario 30 (art. 102.1) · sumario 5 (art. 103.2) · monitorio 5 (art. 110.2).</p>
          {deadlineError && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{deadlineError}</p>}
          {deadline && (
            <div className="mt-5" aria-live="polite">
              <p className="text-lg">
                Vence el <strong>{formatDate(deadline.due)}</strong>
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink-600">
                {deadline.explanation.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {deadline.skipped.some((d) => holidayName(d)) && (
                <p className="mt-2 text-xs text-ink-500">
                  Feriados en el camino:{" "}
                  {deadline.skipped
                    .filter((d) => holidayName(d))
                    .map((d) => `${formatDate(d)} (${holidayName(d)})`)
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
