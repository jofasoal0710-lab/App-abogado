import type { Metadata } from "next";
import { RegistryPanel } from "../../registros/registry-panel";
import { ageOn, formatId, ID_TYPES, MARITAL_STATUS, type IdType, type MaritalStatus } from "@/lib/cr-id";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { ReadBeacon } from "@/components/read-beacon";
import { Badge, EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clientAccessLog, invoices, matters, readAudit, users } from "@/db/schema";
import { invoiceAccessSql, matterAccessSql, requireClientPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO, formatDateTime } from "@/lib/dates";
import { areaLabels, clientTypeLabels, invoiceStatusLabels, matterStatusLabels } from "@/lib/labels";
import { formatMoney, invoiceTotals } from "@/lib/money";
import { READ_VERBS } from "@/lib/read-audit";
import { deleteClientAction, setClientVisibilityAction } from "../actions";

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

  const client = await requireClientPage(user, id); // 404 si no existe o es un cliente confidencial que no ves
  const canManageClient = can(user, "clientes.gestionar_todos") || (can(user, "clientes.gestionar") && client.createdById === user.id);
  const accessLog = canManageClient
    ? await db
        .select({ id: clientAccessLog.id, detail: clientAccessLog.detail, createdAt: clientAccessLog.createdAt, actor: users.name })
        .from(clientAccessLog)
        .leftJoin(users, eq(users.id, clientAccessLog.actorId))
        .where(eq(clientAccessLog.clientId, id))
        .orderBy(desc(clientAccessLog.createdAt), desc(clientAccessLog.id))
        .limit(20)
    : [];

  const clientMatters = await db
    .select()
    .from(matters)
    .where(and(eq(matters.clientId, id), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt));

  const clientInvoices = await db.query.invoices.findMany({
    where: and(eq(invoices.clientId, id), invoiceAccessSql(user)),
    with: { items: true },
    orderBy: desc(invoices.issueDate),
  });

  const reads =
    canManageClient && client.visibility === "confidencial"
      ? await db
          .select({ id: readAudit.id, kind: readAudit.kind, detail: readAudit.detail, createdAt: readAudit.createdAt, who: users.name })
          .from(readAudit)
          .leftJoin(users, eq(users.id, readAudit.userId))
          .where(eq(readAudit.clientId, id))
          .orderBy(desc(readAudit.createdAt), desc(readAudit.id))
          .limit(50)
      : [];

  return (
    <>
      {client.visibility === "confidencial" && <ReadBeacon clientId={client.id} kind="cliente" detail={client.name} />}
      <PageHeader
        title={client.name}
        subtitle={
          <>
            {clientTypeLabels[client.type]}
            {client.taxId ? ` · ${formatId(client.idType, client.taxId)}` : ""}
            {client.visibility === "confidencial" && <span className="badge-amber ml-2">Confidencial</span>}
          </>
        }
        actions={
          <>
            <Link href={`/expedientes/nuevo?cliente=${client.id}`} className="btn-primary">
              Nuevo expediente
            </Link>
            <Link href={`/clientes/${client.id}/editar`} className="btn-secondary">
              Editar
            </Link>
            {can(user, "clientes.gestionar") && (
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
          <h2 className="mb-3 font-serif text-lg font-semibold">Datos del cliente</h2>
          <dl className="space-y-3 text-sm">
            <Row
              label={client.idType ? ID_TYPES[client.idType as IdType] ?? "Identificación" : "Identificación"}
              value={client.taxId ? formatId(client.idType, client.taxId) : null}
            />
            {client.type === "persona" && (
              <>
                <Row
                  label="Fecha de nacimiento"
                  value={client.birthDate ? `${formatDate(client.birthDate)} (${ageOn(client.birthDate, todayISO()) ?? "?"} años)` : null}
                />
                <Row label="Estado civil" value={client.maritalStatus ? MARITAL_STATUS[client.maritalStatus as MaritalStatus] : null} />
              </>
            )}
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

          {can(user, "facturacion.ver") && (
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
                        {inv.kind === "rectificativa" && <span className="badge-amber ml-2">Rectificativa</span>}
                      </td>
                      <td>{formatDate(inv.issueDate)}</td>
                      <td>
                        <Badge kind="invoice" value={inv.status} label={invoiceStatusLabels[inv.status]} />
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(invoiceTotals(inv.items, inv.taxRate, inv.withholdingRate).totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          )}
        </div>

        <div className="lg:col-span-3">
          <RegistryPanel
            target={{ clientId: client.id }}
            defaultReference={client.taxId ? formatId(client.idType, client.taxId) : ""}
            defaultKind={client.idType === "cedula_juridica" ? "sociedad" : "cedula"}
            userId={user.id}
            isPerson={client.type === "persona"}
          />
        </div>

        {canManageClient && (
          <section className="card card-pad lg:col-span-3">
            <h2 className="mb-1 font-serif text-lg font-semibold">Confidencialidad</h2>
            <p className="mb-4 text-sm text-ink-600">
              {client.visibility === "confidencial"
                ? "Confidencial: el cliente solo lo ve quien lo dio de alta o tiene acceso a alguno de sus expedientes. Sus expedientes nunca pueden ser abiertos. Los administradores lo ven si tienen acceso a algún expediente suyo (los restringidos incluidos); para ocultarlo también a ellos, marca sus expedientes como confidenciales."
                : "Abierto: lo ve todo el equipo. Si lo haces confidencial, solo lo verá quien tenga acceso a alguno de sus expedientes (o lo diera de alta)."}
            </p>
            <ActionForm action={setClientVisibilityAction.bind(null, client.id)}>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Visibilidad del cliente" className="w-80">
                  <select className="input" name="visibility" defaultValue={client.visibility}>
                    <option value="abierto">Abierto (todo el equipo)</option>
                    <option value="confidencial">Confidencial</option>
                  </select>
                </Field>
                <SubmitButton>Guardar</SubmitButton>
              </div>
              <p className="hint mt-2">Al hacerlo confidencial, sus expedientes abiertos pasan a restringidos; quien deje de verlos pierde también los eventos que tuviera asignados en ellos.</p>
            </ActionForm>
            {accessLog.length > 0 && (
              <table className="table mt-5">
                <tbody>
                  {accessLog.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                      <td>{l.detail}</td>
                      <td className="text-ink-500">{l.actor ?? "Usuario eliminado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {client.visibility === "confidencial" && (
              <>
                <h3 className="label mt-6">Lecturas recientes (últimas 50)</h3>
                {reads.length === 0 ? (
                  <p className="text-sm text-ink-500">Aún no se ha registrado ninguna lectura.</p>
                ) : (
                  <table className="table">
                    <tbody>
                      {reads.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                          <td>{r.who ?? "Usuario eliminado"}</td>
                          <td className="text-ink-700">
                            {READ_VERBS[r.kind]} {r.detail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        )}
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
