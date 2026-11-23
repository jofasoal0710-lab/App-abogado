import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { EmptyState, Field } from "@/components/ui";
import { db } from "@/db";
import { invoices, payments, type Matter } from "@/db/schema";
import { formatDate, todayISO } from "@/lib/dates";
import { FUND_KINDS, fundSign, fundsStatus, maxApplicable, runningBalances } from "@/lib/funds";
import { fundMovements } from "@/lib/funds-db";
import { netTotal } from "@/lib/invoice-queries";
import { entries, paymentMethodLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { applyFundsToInvoiceAction, deleteFundMovementAction, depositFundsAction, refundFundsAction, setFundsMinAction } from "../funds-actions";

const MANUAL_METHODS = entries(paymentMethodLabels).filter(([v]) => v !== "provision");

/** Facturas emitidas del expediente con algo pendiente de cobro. */
export async function pendingInvoices(matterId: number) {
  const inv = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.matterId, matterId), eq(invoices.kind, "factura"), eq(invoices.status, "emitida")));
  if (!inv.length) return [];
  const paid = await db.select({ invoiceId: payments.invoiceId, a: payments.amountCents }).from(payments).where(inArray(payments.invoiceId, inv.map((i) => i.id)));
  const out = [];
  for (const i of inv) {
    const net = (await netTotal(db, i.id)) ?? 0;
    const outstanding = net - paid.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.a, 0);
    if (outstanding > 0) out.push({ ...i, outstanding });
  }
  return out;
}

/** «Provisión de fondos»: el dinero del cliente que el despacho custodia para este expediente. */
export async function FundsSection({ matter, canCollect, canEmit }: { matter: Matter; canCollect: boolean; canEmit: boolean }) {
  const [rows, pending] = await Promise.all([fundMovements(db, matter.id), pendingInvoices(matter.id)]);
  const ledger = runningBalances(rows);
  const balance = ledger.at(-1)?.balanceCents ?? 0;
  const status = fundsStatus(balance, matter.fundsMinCents, rows.length > 0);

  return (
    <section className="card" id="provision">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Provisión de fondos</h2>
          <p className="text-xs text-ink-500">Dinero que el cliente entrega por adelantado. Paga gastos y facturas de este expediente; lo que sobre se le devuelve.</p>
        </div>
        <p className="text-sm">
          Saldo disponible: <strong className="tabular-nums" data-testid="funds-balance">{formatMoney(balance)}</strong>
        </p>
      </div>

      {(status === "bajo" || status === "agotado") && (
        <p role="alert" className="mx-5 mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {status === "agotado" ? "La provisión está agotada." : `El saldo está por debajo del mínimo (${formatMoney(matter.fundsMinCents!)}).`} Conviene pedir al cliente un nuevo depósito.
        </p>
      )}

      {ledger.length === 0 ? (
        <EmptyState title="Sin provisión de fondos">Registra el depósito del cliente para pagar con él gastos, timbres y facturas.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th className="text-right">Entra</th>
                <th className="text-right">Sale</th>
                <th className="text-right">Saldo</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {ledger.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatDate(m.movedOn)}</td>
                  <td>
                    {m.description}
                    <span className="block text-xs text-ink-500">
                      {FUND_KINDS[m.kind]}
                      {m.method && m.kind !== "gasto" && m.kind !== "aplicacion" ? ` · ${paymentMethodLabels[m.method]}` : ""}
                      {m.reference ? ` · ${m.reference}` : ""}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{fundSign(m.kind) > 0 ? formatMoney(m.amountCents) : ""}</td>
                  <td className="text-right tabular-nums">{fundSign(m.kind) < 0 ? formatMoney(m.amountCents) : ""}</td>
                  <td className="text-right tabular-nums">{formatMoney(m.balanceCents)}</td>
                  <td className="whitespace-nowrap">
                    {(m.kind === "deposito" || m.kind === "devolucion") && (
                      <Link href={`/expedientes/${matter.id}/provision/${m.id}`} className="btn-ghost btn-sm">
                        Recibo
                      </Link>
                    )}
                    {canEmit && (m.kind === "deposito" || m.kind === "devolucion") && (
                      <ActionForm action={deleteFundMovementAction.bind(null, m.id, matter.id)} className="inline">
                        <ConfirmButton message={`¿Borrar «${m.description}» (${formatMoney(m.amountCents)})?`} className="btn-ghost btn-sm text-red-700">
                          Borrar
                        </ConfirmButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canCollect && (
        <div className="grid gap-4 border-t border-ink-100 px-5 py-4 lg:grid-cols-2">
          <ActionForm action={depositFundsAction.bind(null, matter.id)} resetOnSuccess className="space-y-3 rounded-lg border border-ink-100 p-4">
            <h3 className="font-semibold">Registrar depósito del cliente</h3>
            <MovementFields defaultDescription="Provisión de fondos" />
            <SubmitButton>Registrar depósito</SubmitButton>
          </ActionForm>

          <ActionForm action={applyFundsToInvoiceAction.bind(null, matter.id)} resetOnSuccess className="space-y-3 rounded-lg border border-ink-100 p-4">
            <h3 className="font-semibold">Pagar una factura con la provisión</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-ink-500">No hay facturas emitidas de este expediente pendientes de cobro.</p>
            ) : (
              <>
                <Field label="Factura">
                  <select className="input" name="invoiceId" required>
                    {pending.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · pendiente {formatMoney(i.outstanding)} · se pueden aplicar {formatMoney(maxApplicable(balance, i.outstanding))}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Importe (₡)" hint="Lo que falte por cobrar, sin pasar del saldo de la provisión.">
                  <input className="input" name="amount" required inputMode="decimal" defaultValue={pending[0] ? String(maxApplicable(balance, pending[0].outstanding) / 100) : ""} />
                </Field>
                <SubmitButton>Aplicar a la factura</SubmitButton>
              </>
            )}
          </ActionForm>

          <ActionForm action={refundFundsAction.bind(null, matter.id)} resetOnSuccess className="space-y-3 rounded-lg border border-ink-100 p-4">
            <h3 className="font-semibold">Devolver saldo al cliente</h3>
            <MovementFields defaultDescription="Devolución del saldo al cliente" amount={balance > 0 ? String(balance / 100) : ""} />
            <SubmitButton className="btn-secondary">Registrar devolución</SubmitButton>
          </ActionForm>

          <ActionForm action={setFundsMinAction.bind(null, matter.id)} className="space-y-3 rounded-lg border border-ink-100 p-4">
            <h3 className="font-semibold">Aviso de saldo bajo</h3>
            <Field label="Saldo mínimo (₡)" hint="Por debajo, el expediente y los reportes avisan para pedir otro depósito. Vacío = sin aviso.">
              <input className="input" name="min" inputMode="decimal" defaultValue={matter.fundsMinCents != null ? String(matter.fundsMinCents / 100) : ""} />
            </Field>
            <SubmitButton className="btn-secondary">Guardar</SubmitButton>
          </ActionForm>
        </div>
      )}
    </section>
  );
}

function MovementFields({ defaultDescription, amount = "" }: { defaultDescription: string; amount?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Importe (₡)">
        <input className="input" name="amount" required inputMode="decimal" defaultValue={amount} />
      </Field>
      <Field label="Fecha">
        <input className="input" type="date" name="movedOn" defaultValue={todayISO()} />
      </Field>
      <Field label="Forma">
        <select className="input" name="method" defaultValue="transferencia">
          {MANUAL_METHODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Referencia">
        <input className="input" name="reference" maxLength={200} placeholder="N.º de transferencia o cheque" />
      </Field>
      <Field label="Concepto" className="sm:col-span-2">
        <input className="input" name="description" maxLength={300} defaultValue={defaultDescription} />
      </Field>
    </div>
  );
}
