import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, PrintButton, SubmitButton } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { canManageInvoices, requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatDate, todayISO } from "@/lib/dates";
import { invoiceErrorMessage } from "@/lib/invoice-errors";
import { summarizeInvoice } from "@/lib/invoices";
import { entries, invoiceStatusLabels, paymentMethodLabels } from "@/lib/labels";
import { formatMoney, formatQuantity, lineAmountCents } from "@/lib/money";
import {
  addItemAction,
  deleteDraftAction,
  deleteItemAction,
  deletePaymentAction,
  emitInvoiceAction,
  registerPaymentAction,
  updateInvoiceHeaderAction,
  voidInvoiceAction,
} from "../actions";

export const metadata: Metadata = { title: "Factura" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { error } = await searchParams;

  const inv = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), matterAccessSql(user, invoices.matterId, { orNone: true })),
    with: { client: true, matter: true, items: { orderBy: (i) => asc(i.id) }, payments: { orderBy: (p) => asc(p.paidAt) } },
  });
  if (!inv) notFound();

  const today = todayISO();
  const s = summarizeInvoice(inv, today);
  const isDraft = inv.status === "borrador";
  const manage = canManageInvoices(user);
  const errorMessage = invoiceErrorMessage(error);

  return (
    <>
      <PageHeader
        title={inv.number ?? `Borrador #${inv.id}`}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Badge kind="invoice" value={inv.status} label={invoiceStatusLabels[inv.status]} />
            {s.overdue && <span className="badge-red">Vencida</span>}
            {inv.matter && (
              <Link className="link" href={`/expedientes/${inv.matter.id}`}>
                {inv.matter.number}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <PrintButton />
            {isDraft && manage && (
              <form action={emitInvoiceAction.bind(null, inv.id)}>
                <ConfirmButton
                  message="Al emitir se asigna el número definitivo y la factura deja de ser editable. ¿Continuar?"
                  className="btn-primary"
                >
                  Emitir factura
                </ConfirmButton>
              </form>
            )}
            {isDraft && (
              <form action={deleteDraftAction.bind(null, inv.id)}>
                <ConfirmButton message="¿Eliminar este borrador? Las horas asociadas quedarán libres para facturarlas de nuevo." className="btn-danger">
                  Eliminar borrador
                </ConfirmButton>
              </form>
            )}
            {inv.status === "emitida" && manage && (
              <form action={voidInvoiceAction.bind(null, inv.id)}>
                <ConfirmButton message="¿Anular la factura? El número no se reutilizará y las horas quedarán libres." className="btn-danger">
                  Anular
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />

      {errorMessage && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <article className="card card-pad">
        <div className="flex flex-wrap justify-between gap-6 border-b border-ink-100 pb-5">
          <div>
            <p className="font-serif text-xl font-semibold text-ink-900">{config.firmName}</p>
            {config.firmTaxId && <p className="text-sm text-ink-600">NIF {config.firmTaxId}</p>}
            {config.firmAddress && <p className="text-sm text-ink-600">{config.firmAddress}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="font-serif text-xl font-semibold uppercase tracking-wide text-ink-900">Factura</p>
            <p className="text-ink-700">{inv.number ?? "Borrador"}</p>
            <p className="text-ink-600">Fecha: {formatDate(inv.issueDate)}</p>
            <p className="text-ink-600">Vencimiento: {formatDate(inv.dueDate)}</p>
          </div>
        </div>

        <div className="border-b border-ink-100 py-5 text-sm">
          <p className="label">Cliente</p>
          <p className="font-medium text-ink-900">{inv.client.name}</p>
          {inv.client.taxId && <p className="text-ink-600">NIF/CIF {inv.client.taxId}</p>}
          {inv.client.address && <p className="text-ink-600">{inv.client.address}</p>}
          {inv.matter && <p className="mt-2 text-ink-600">Expediente: {inv.matter.number} · {inv.matter.title}</p>}
        </div>

        <div className="overflow-x-auto py-2">
          <table className="table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Importe</th>
                {isDraft && <th className="no-print w-px" />}
              </tr>
            </thead>
            <tbody>
              {inv.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-500">
                    Aún no hay líneas. Añade conceptos con el formulario inferior.
                  </td>
                </tr>
              )}
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.description}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatQuantity(it)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {formatMoney(it.unitPriceCents)}
                    {it.unit === "horas" && <span className="text-ink-500"> /h</span>}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatMoney(lineAmountCents(it))}</td>
                  {isDraft && (
                    <td className="no-print">
                      <form action={deleteItemAction.bind(null, inv.id, it.id)}>
                        <ConfirmButton message="¿Quitar esta línea?" className="btn-ghost btn-sm text-red-700">
                          Quitar
                        </ConfirmButton>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">Base imponible</dt>
            <dd className="tabular-nums">{formatMoney(s.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-600">IVA ({inv.taxRate} %)</dt>
            <dd className="tabular-nums">{formatMoney(s.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(s.totalCents)}</dd>
          </div>
          {!isDraft && inv.status !== "anulada" && (
            <div className="flex justify-between text-ink-600">
              <dt>Pendiente de cobro</dt>
              <dd className="tabular-nums">{formatMoney(s.outstandingCents)}</dd>
            </div>
          )}
        </dl>

        {inv.notes && <p className="mt-6 whitespace-pre-wrap border-t border-ink-100 pt-4 text-sm text-ink-600">{inv.notes}</p>}
      </article>

      {isDraft && (
        <div className="no-print mt-6 grid gap-6 lg:grid-cols-2">
          <ActionForm action={addItemAction.bind(null, inv.id)} resetOnSuccess className="card card-pad">
            <h2 className="mb-3 font-serif text-lg font-semibold">Añadir línea</h2>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Concepto" className="sm:col-span-6">
                <input className="input" name="description" required maxLength={1000} />
              </Field>
              <Field label="Tipo" className="sm:col-span-2">
                <select className="input" name="unit" defaultValue="unidades">
                  <option value="unidades">Unidades</option>
                  <option value="horas">Horas</option>
                </select>
              </Field>
              <Field label="Cantidad" className="sm:col-span-2" hint="2 · 1,5 · 1:30 (horas)">
                <input className="input" name="quantity" defaultValue="1" required />
              </Field>
              <Field label="Precio (€)" className="sm:col-span-2">
                <input className="input" name="unitPrice" inputMode="decimal" required />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <SubmitButton>Añadir</SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={updateInvoiceHeaderAction.bind(null, inv.id)} className="card card-pad">
            <h2 className="mb-3 font-serif text-lg font-semibold">Datos de la factura</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fecha">
                <input className="input" type="date" name="issueDate" defaultValue={inv.issueDate} required />
              </Field>
              <Field label="Vencimiento">
                <input className="input" type="date" name="dueDate" defaultValue={inv.dueDate ?? ""} />
              </Field>
              <Field label="IVA (%)">
                <input className="input" name="taxRate" inputMode="numeric" defaultValue={inv.taxRate} required />
              </Field>
              <Field label="Notas" className="sm:col-span-3">
                <textarea className="input min-h-20" name="notes" defaultValue={inv.notes ?? ""} maxLength={3000} />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <SubmitButton>Guardar datos</SubmitButton>
            </div>
          </ActionForm>
        </div>
      )}

      {!isDraft && inv.status !== "anulada" && (
        <section className="no-print mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Cobros</h2>
            {inv.payments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-500">Todavía no se ha registrado ningún cobro.</p>
            ) : (
              <table className="table">
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{formatDate(p.paidAt)}</td>
                      <td>
                        {paymentMethodLabels[p.method]}
                        {p.reference && <span className="block text-xs text-ink-500">{p.reference}</span>}
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(p.amountCents)}</td>
                      <td>
                        {manage && (
                          <form action={deletePaymentAction.bind(null, inv.id, p.id)}>
                            <ConfirmButton message="¿Eliminar este cobro?" className="btn-ghost btn-sm text-red-700">
                              Borrar
                            </ConfirmButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {inv.status === "emitida" && (
            <ActionForm action={registerPaymentAction.bind(null, inv.id)} resetOnSuccess className="card card-pad">
              <h2 className="mb-3 font-serif text-lg font-semibold">Registrar cobro</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Importe (€)">
                  <input
                    className="input"
                    name="amount"
                    inputMode="decimal"
                    defaultValue={(s.outstandingCents / 100).toFixed(2).replace(".", ",")}
                    required
                  />
                </Field>
                <Field label="Fecha">
                  <input className="input" type="date" name="paidAt" defaultValue={today} required />
                </Field>
                <Field label="Forma de pago">
                  <select className="input" name="method" defaultValue="transferencia">
                    {entries(paymentMethodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Referencia">
                  <input className="input" name="reference" maxLength={200} />
                </Field>
              </div>
              <div className="mt-3 flex justify-end">
                <SubmitButton pendingText="Registrando…">Registrar cobro</SubmitButton>
              </div>
            </ActionForm>
          )}
        </section>
      )}
    </>
  );
}
