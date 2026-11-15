import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, lt, or, type SQL } from "drizzle-orm";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { summarizeInvoice } from "@/lib/invoices";
import { entries, invoiceStatusLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { likePattern, pageParam, qs } from "@/lib/search";

export const metadata: Metadata = { title: "Facturas" };
const PAGE_SIZE = 20;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = sp.estado ?? "";
  const page = pageParam(sp.page);
  const today = todayISO();

  const filters: (SQL | undefined)[] = [];
  if (q) filters.push(or(ilike(invoices.number, likePattern(q)), ilike(clients.name, likePattern(q))));
  if (estado === "vencidas") {
    filters.push(eq(invoices.status, "emitida"));
    filters.push(lt(invoices.dueDate, today));
  } else if (estado in invoiceStatusLabels) {
    filters.push(eq(invoices.status, estado as keyof typeof invoiceStatusLabels));
  }
  filters.push(matterAccessSql(user, invoices.matterId, { orNone: true }));
  const where = and(...filters);

  const [{ total }] = await db
    .select({ total: count() })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where);

  const pageIds = await db
    .select({ id: invoices.id })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)
    .orderBy(desc(invoices.issueDate), desc(invoices.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const rows = pageIds.length
    ? await db.query.invoices.findMany({
        where: (i, { inArray }) => inArray(i.id, pageIds.map((r) => r.id)),
        with: { client: true, items: true, payments: true },
        orderBy: [desc(invoices.issueDate), desc(invoices.id)],
      })
    : [];

  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle={`${total} ${total === 1 ? "factura" : "facturas"}`}
        actions={
          <Link href="/facturas/nueva" className="btn-primary">
            Nueva factura
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input className="input max-w-xs" type="search" name="q" defaultValue={q} placeholder="Nº de factura o cliente" />
        <select className="input w-auto" name="estado" defaultValue={estado} aria-label="Estado">
          <option value="">Todos los estados</option>
          {entries(invoiceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="vencidas">Vencidas sin cobrar</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
        {(q || estado) && (
          <Link href="/facturas" className="btn-ghost">
            Limpiar
          </Link>
        )}
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No hay facturas con estos filtros" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th className="text-right">Total</th>
                <th className="text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const s = summarizeInvoice(inv, today);
                return (
                  <tr key={inv.id} className="row-link">
                    <td>
                      <Link className="link" href={`/facturas/${inv.id}`}>
                        {inv.number ?? `Borrador #${inv.id}`}
                      </Link>
                    </td>
                    <td>{inv.client.name}</td>
                    <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                    <td className="whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                    <td className="whitespace-nowrap">
                      <Badge kind="invoice" value={inv.status} label={invoiceStatusLabels[inv.status]} />
                      {s.overdue && <span className="badge-red ml-1">Vencida</span>}
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(s.totalCents)}</td>
                    <td className="text-right tabular-nums">{s.outstandingCents ? formatMoney(s.outstandingCents) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/facturas${qs({ q, estado, page: p })}`} />
      </div>
    </>
  );
}
