import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, ilike, or } from "drizzle-orm";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { clientAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { clientTypeLabels } from "@/lib/labels";
import { likePattern, pageParam, qs } from "@/lib/search";

export const metadata: Metadata = { title: "Clientes" };
const PAGE_SIZE = 20;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = pageParam(sp.page);

  const search = q
    ? or(
        ilike(clients.name, likePattern(q)),
        ilike(clients.taxId, likePattern(q)),
        ilike(clients.email, likePattern(q)),
        ilike(clients.phone, likePattern(q)),
      )
    : undefined;
  const where = and(search, clientAccessSql(user, clients.id));

  const [{ total }] = await db.select({ total: count() }).from(clients).where(where);
  const rows = await db
    .select()
    .from(clients)
    .where(where)
    .orderBy(desc(clients.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${total} ${total === 1 ? "cliente" : "clientes"}`}
        actions={
          <Link href="/clientes/nuevo" className="btn-primary">
            Nuevo cliente
          </Link>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <input
          className="input max-w-sm"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, NIF, correo o teléfono"
        />
        <button className="btn-secondary">Buscar</button>
        {q && (
          <Link href="/clientes" className="btn-ghost">
            Limpiar
          </Link>
        )}
      </form>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title={q ? "Sin resultados" : "Aún no hay clientes"}>
            {q ? "Prueba con otro término de búsqueda." : "Crea el primero con el botón «Nuevo cliente»."}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>NIF / CIF</th>
                <th>Contacto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="row-link">
                  <td>
                    <Link href={`/clientes/${c.id}`} className="link">
                      {c.name}
                    </Link>
                  </td>
                  <td>{clientTypeLabels[c.type]}</td>
                  <td>{c.taxId ?? "—"}</td>
                  <td className="text-ink-600">
                    {c.email ?? "—"}
                    {c.phone && <span className="block text-xs">{c.phone}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/clientes${qs({ q, page: p })}`} />
      </div>
    </>
  );
}
