import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, invoices, matters } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { areaLabels, clientTypeLabels, invoiceStatusLabels, matterStatusLabels } from "@/lib/labels";
import { formatMoney, invoiceTotals } from "@/lib/money";
import { deleteClientAction } from "../actions";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({
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

  const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!client) notFound();

  const clientMatters = await db
    .select()
    .from(matters)
    .where(and(eq(matters.clientId, id), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt));

  const clientInvoices = await db.query.invoices.findMany({
    where: and(eq(invoices.clientId, id), matterAccessSql(user, invoices.matterId, { orNone: true })),
    with: { items: true },
    orderBy: desc(invoices.issueDate),
  });

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${clientTypeLabels[client.type]}${client.taxId ? ` · ${client.taxId}` : ""}`}
        actions={
          <>
            <Link href={`/expedientes/nuevo?cliente=${client.id}`} className="btn-primary">
              Nuevo expediente
            </Link>
            <Link href={`/clientes/${client.id}/editar`} className="btn-secondary">
              Editar
            </Link>
            {user.role !== "asistente" && (
              <form action={deleteClientAction.bind(null, client.id)}>
                <ConfirmButton message="¿Eliminar este cliente? Esta acción no se puede deshacer.">
                  Eliminar
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />

      {error === "in_use" && (
        <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No se puede eliminar: el cliente tiene expedientes o facturas asociados.
        </p>
      )}
      {error === "forbidden" && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No tienes permiso para eliminar clientes.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-1">
          <h2 className="mb-3 font-serif text-lg font-semibold">Datos de contacto</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Correo" value={client.email && <a className="link" href={`mailto:${client.email}`}>{client.email}</a>} />
            <Row label="Teléfono" value={client.phone} />
            <Row label="Dirección" value={client.address} />
            <Row label="Alta" value={formatDate(client.createdAt)} />
          </dl>
          {client.notes && (
            <>
              <h3 className="label mt-5">Notas</h3>
              <p className="whitespace-pre-wrap text-sm text-ink-700">{client.notes}</p>
            </>
          )}
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section className="card overflow-x-auto">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Expedientes</h2>
            {clientMatters.length === 0 ? (
              <EmptyState title="Sin expedientes" />
            ) : (
              <table className="table">
                <tbody>
                  {clientMatters.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/expedientes/${m.id}`} className="link">
                          {m.number}
                        </Link>
                        <span className="block text-ink-700">{m.title}</span>
                      </td>
                      <td>{areaLabels[m.area]}</td>
                      <td>
                        <Badge kind="matter" value={m.status} label={matterStatusLabels[m.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card overflow-x-auto">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Facturas</h2>
            {clientInvoices.length === 0 ? (
              <EmptyState title="Sin facturas" />
            ) : (
              <table className="table">
                <tbody>
                  {clientInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/facturas/${inv.id}`} className="link">
                          {inv.number ?? `Borrador #${inv.id}`}
                        </Link>
                      </td>
                      <td>{formatDate(inv.issueDate)}</td>
                      <td>
                        <Badge kind="invoice" value={inv.status} label={invoiceStatusLabels[inv.status]} />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(invoiceTotals(inv.items, inv.taxRate).totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-ink-800">{value || "—"}</dd>
    </div>
  );
}
