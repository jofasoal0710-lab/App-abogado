import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { Badge, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { db } from "@/db";
import { clients, matters, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { areaLabels, entries, matterStatusLabels } from "@/lib/labels";
import { likePattern, pageParam, qs } from "@/lib/search";

export const metadata: Metadata = { title: "Expedientes" };
const PAGE_SIZE = 20;

type Sp = { q?: string; estado?: string; area?: string; mios?: string; page?: string };

export default async function MattersPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = sp.estado ?? "activos";
  const area = sp.area ?? "";
  const mine = sp.mios === "1";
  const page = pageParam(sp.page);

  const filters: (SQL | undefined)[] = [];
  if (q) {
    filters.push(
      or(
        ilike(matters.number, likePattern(q)),
        ilike(matters.title, likePattern(q)),
        ilike(clients.name, likePattern(q)),
        ilike(matters.courtCaseNumber, likePattern(q)),
        ilike(matters.opposingParty, likePattern(q)),
      ),
    );
  }
  if (estado === "activos") filters.push(inArray(matters.status, ["abierto", "en_curso", "en_espera"]));
  else if (estado in matterStatusLabels) filters.push(eq(matters.status, estado as keyof typeof matterStatusLabels));
  if (area in areaLabels) filters.push(eq(matters.area, area as keyof typeof areaLabels));
  if (mine) filters.push(eq(matters.responsibleId, user.id));
  const where = and(...filters);

  const [{ total }] = await db
    .select({ total: count() })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(where);

  const rows = await db
    .select({
      id: matters.id,
      number: matters.number,
      title: matters.title,
      area: matters.area,
      status: matters.status,
      openedAt: matters.openedAt,
      clientId: clients.id,
      clientName: clients.name,
      responsible: users.name,
    })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .leftJoin(users, eq(users.id, matters.responsibleId))
    .where(where)
    .orderBy(desc(matters.openedAt), desc(matters.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const filterParams = { q, estado, area, mios: mine ? "1" : "" };

  return (
    <>
      <PageHeader
        title="Expedientes"
        subtitle={`${total} ${total === 1 ? "expediente" : "expedientes"}`}
        actions={
          <Link href="/expedientes/nuevo" className="btn-primary">
            Nuevo expediente
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          className="input max-w-xs"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nº, título, cliente, procedimiento…"
        />
        <select className="input w-auto" name="estado" defaultValue={estado} aria-label="Estado">
          <option value="activos">Activos</option>
          <option value="todos">Todos los estados</option>
          {entries(matterStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className="input w-auto" name="area" defaultValue={area} aria-label="Área">
          <option value="">Todas las áreas</option>
          {entries(areaLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="mios" value="1" defaultChecked={mine} />
          Solo los míos
        </label>
        <button className="btn-secondary">Filtrar</button>
        {(q || area || mine || estado !== "activos") && (
          <Link href="/expedientes" className="btn-ghost">
            Limpiar
          </Link>
        )}
      </form>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="No hay expedientes con estos filtros">
            <Link href="/expedientes/nuevo" className="link">
              Crear un expediente
            </Link>
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Cliente</th>
                <th>Área</th>
                <th>Responsable</th>
                <th>Apertura</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="row-link">
                  <td>
                    <Link href={`/expedientes/${m.id}`} className="link">
                      {m.number}
                    </Link>
                    <span className="block max-w-xs text-ink-700">{m.title}</span>
                  </td>
                  <td>
                    <Link href={`/clientes/${m.clientId}`} className="hover:underline">
                      {m.clientName}
                    </Link>
                  </td>
                  <td>{areaLabels[m.area]}</td>
                  <td>{m.responsible ?? "—"}</td>
                  <td>{formatDate(m.openedAt)}</td>
                  <td>
                    <Badge kind="matter" value={m.status} label={matterStatusLabels[m.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/expedientes${qs({ ...filterParams, page: p })}`} />
      </div>
    </>
  );
}
