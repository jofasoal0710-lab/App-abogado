import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Badge, EmptyState, PageHeader, Stat } from "@/components/ui";
import { db } from "@/db";
import { documents, events, invoices, matterNotes, matters, clients, timeEntries, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { canManageInvoices, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { areaLabels, billingTypeLabels, entries, invoiceStatusLabels, matterStatusLabels } from "@/lib/labels";
import { formatDuration, formatMoney, invoiceTotals } from "@/lib/money";
import { DocumentsTable } from "../../documentos/documents-table";
import { UploadForm } from "../../documentos/upload-form";
import { EventsList } from "../../agenda/events-list";
import { TimeEntriesTable } from "../../horas/time-entries-table";
import { TimeEntryForm } from "../../horas/time-entry-form";
import { addNoteAction, changeStatusAction, deleteMatterAction, deleteNoteAction } from "../actions";

export const metadata: Metadata = { title: "Expediente" };

const TABS = [
  ["resumen", "Resumen"],
  ["notas", "Notas"],
  ["documentos", "Documentos"],
  ["horas", "Horas"],
  ["agenda", "Agenda"],
  ["facturas", "Facturas"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const tab: Tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as Tab) : "resumen";

  const [row] = await db
    .select({ matter: matters, client: clients, responsible: users.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .leftJoin(users, eq(users.id, matters.responsibleId))
    .where(eq(matters.id, id))
    .limit(1);
  if (!row) notFound();
  const { matter, client } = row;

  // Estadísticas económicas (siempre visibles en la cabecera).
  const [pending] = await db
    .select({
      minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int`,
      cents: sql<number>`coalesce(sum(round(${timeEntries.minutes} * ${timeEntries.rateCents} / 60.0)), 0)::int`,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.matterId, id), eq(timeEntries.billable, true), isNull(timeEntries.invoiceId)));

  const matterInvoices = await db.query.invoices.findMany({
    where: eq(invoices.matterId, id),
    with: { items: true, payments: true },
    orderBy: desc(invoices.issueDate),
  });
  const active = matterInvoices.filter((i) => i.status !== "anulada");
  const invoicedCents = active.reduce((s, i) => s + invoiceTotals(i.items, i.taxRate).totalCents, 0);
  const invoicedSubtotal = active.reduce((s, i) => s + invoiceTotals(i.items, i.taxRate).subtotalCents, 0);
  const paidCents = active.reduce((s, i) => s + i.payments.reduce((p, x) => p + x.amountCents, 0), 0);
  const toInvoiceCents =
    matter.billingType === "tarifa_fija" ? Math.max(0, (matter.fixedFeeCents ?? 0) - invoicedSubtotal) : pending.cents;

  const base = `/expedientes/${id}`;
  return (
    <>
      <PageHeader
        title={matter.title}
        subtitle={
          <>
            {matter.number} · <Link className="link" href={`/clientes/${client.id}`}>{client.name}</Link> · {areaLabels[matter.area]}
          </>
        }
        actions={
          <>
            <Link href={`${base}/editar`} className="btn-secondary">
              Editar
            </Link>
            {user.role === "admin" && (
              <form action={deleteMatterAction.bind(null, id)}>
                <ConfirmButton message="¿Eliminar el expediente con sus notas, horas, eventos y documentos? No se puede deshacer.">
                  Eliminar
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />

      {sp.error === "has_invoices" && (
        <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No se puede eliminar un expediente con facturas asociadas. Archívalo en su lugar.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Estado</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge kind="matter" value={matter.status} label={matterStatusLabels[matter.status]} />
          </div>
          <form action={changeStatusAction.bind(null, id)} className="mt-3 flex gap-2">
            <select className="input py-1.5" name="status" defaultValue={matter.status} aria-label="Cambiar estado">
              {entries(matterStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn-secondary btn-sm">Cambiar</button>
          </form>
        </div>
        <Stat
          label="Pendiente de facturar"
          value={formatMoney(toInvoiceCents)}
          hint={matter.billingType === "tarifa_fija" ? "Honorarios fijos aún no facturados" : `${formatDuration(pending.minutes)} facturables`}
        />
        <Stat label="Facturado (IVA incl.)" value={formatMoney(invoicedCents)} hint={`${active.length} ${active.length === 1 ? "factura" : "facturas"}`} />
        <Stat
          label="Pendiente de cobro"
          value={formatMoney(Math.max(0, invoicedCents - paidCents))}
          tone={invoicedCents - paidCents > 0 ? "warn" : "default"}
          hint={`Cobrado: ${formatMoney(paidCents)}`}
        />
      </div>

      <nav className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Secciones del expediente">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === "resumen" ? base : `${base}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && (
        <section className="card card-pad">
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Cliente" value={<Link className="link" href={`/clientes/${client.id}`}>{client.name}</Link>} />
            <Item label="Abogado responsable" value={row.responsible} />
            <Item label="Apertura" value={formatDate(matter.openedAt)} />
            <Item label="Cierre" value={matter.closedAt ? formatDate(matter.closedAt) : null} />
            <Item label="Juzgado o tribunal" value={matter.court} />
            <Item label="Nº de procedimiento" value={matter.courtCaseNumber} />
            <Item label="Parte contraria" value={matter.opposingParty} />
            <Item
              label="Honorarios"
              value={`${billingTypeLabels[matter.billingType]}${matter.billingType === "tarifa_fija" && matter.fixedFeeCents ? ` · ${formatMoney(matter.fixedFeeCents)}` : ""}`}
            />
          </dl>
          {matter.description && (
            <>
              <h2 className="label mt-6">Descripción</h2>
              <p className="whitespace-pre-wrap text-sm text-ink-700">{matter.description}</p>
            </>
          )}
        </section>
      )}

      {tab === "notas" && <NotesTab matterId={id} userId={user.id} isAdmin={user.role === "admin"} />}

      {tab === "documentos" && <DocumentsTab matterId={id} user={user} />}

      {tab === "horas" && <HoursTab matterId={id} user={user} />}

      {tab === "agenda" && <AgendaTab matterId={id} base={base} />}

      {tab === "facturas" && (
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">Facturas del expediente</h2>
            {canManageInvoices(user) && (
              <Link href={`/facturas/nueva?expediente=${id}`} className="btn-primary btn-sm">
                Nueva factura
              </Link>
            )}
          </div>
          {matterInvoices.length === 0 ? (
            <EmptyState title="Sin facturas" />
          ) : (
            <table className="table">
              <tbody>
                {matterInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link className="link" href={`/facturas/${inv.id}`}>
                        {inv.number ?? `Borrador #${inv.id}`}
                      </Link>
                    </td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td>
                      <Badge kind="invoice" value={inv.status} label={invoiceStatusLabels[inv.status]} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(invoiceTotals(inv.items, inv.taxRate).totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-ink-800">{value || "—"}</dd>
    </div>
  );
}

async function NotesTab({ matterId, userId, isAdmin }: { matterId: number; userId: number; isAdmin: boolean }) {
  const notes = await db
    .select({ id: matterNotes.id, body: matterNotes.body, createdAt: matterNotes.createdAt, authorId: matterNotes.authorId, author: users.name })
    .from(matterNotes)
    .leftJoin(users, eq(users.id, matterNotes.authorId))
    .where(eq(matterNotes.matterId, matterId))
    .orderBy(desc(matterNotes.createdAt));

  return (
    <div className="space-y-4">
      <ActionForm action={addNoteAction.bind(null, matterId)} resetOnSuccess className="card card-pad">
        <label className="label" htmlFor="note-body">
          Nueva nota
        </label>
        <textarea id="note-body" name="body" className="input min-h-24" required maxLength={10000} />
        <div className="mt-3 flex justify-end">
          <SubmitButton pendingText="Añadiendo…">Añadir nota</SubmitButton>
        </div>
      </ActionForm>
      <div className="card">
        {notes.length === 0 ? (
          <EmptyState title="Sin notas" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {notes.map((n) => (
              <li key={n.id} className="px-5 py-4">
                <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
                  <span>
                    <strong className="text-ink-700">{n.author ?? "Usuario eliminado"}</strong> · {formatDateTime(n.createdAt)}
                  </span>
                  {(isAdmin || n.authorId === userId) && (
                    <form action={deleteNoteAction.bind(null, n.id, matterId)}>
                      <ConfirmButton message="¿Eliminar esta nota?" className="btn-ghost btn-sm text-red-700">
                        Borrar
                      </ConfirmButton>
                    </form>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-800">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function DocumentsTab({ matterId, user }: { matterId: number; user: Awaited<ReturnType<typeof requireUser>> }) {
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      category: documents.category,
      sizeBytes: documents.sizeBytes,
      createdAt: documents.createdAt,
      uploader: users.name,
      matterId: documents.matterId,
      matterNumber: matters.number,
    })
    .from(documents)
    .innerJoin(matters, eq(matters.id, documents.matterId))
    .leftJoin(users, eq(users.id, documents.uploadedById))
    .where(eq(documents.matterId, matterId))
    .orderBy(desc(documents.createdAt));

  return (
    <div className="space-y-4">
      <UploadForm matterId={matterId} />
      <div className="card">
        <DocumentsTable rows={rows} user={user} showMatter={false} />
      </div>
    </div>
  );
}

async function HoursTab({ matterId, user }: { matterId: number; user: Awaited<ReturnType<typeof requireUser>> }) {
  const rows = await db
    .select({
      id: timeEntries.id,
      workedOn: timeEntries.workedOn,
      minutes: timeEntries.minutes,
      description: timeEntries.description,
      rateCents: timeEntries.rateCents,
      billable: timeEntries.billable,
      invoiceId: timeEntries.invoiceId,
      userId: timeEntries.userId,
      userName: users.name,
      matterId: timeEntries.matterId,
      matterNumber: matters.number,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .innerJoin(matters, eq(matters.id, timeEntries.matterId))
    .where(eq(timeEntries.matterId, matterId))
    .orderBy(desc(timeEntries.workedOn), desc(timeEntries.id));

  return (
    <div className="space-y-4">
      <TimeEntryForm matterId={matterId} defaultRateCents={user.hourlyRateCents} />
      <div className="card">
        <TimeEntriesTable rows={rows} user={user} showMatter={false} />
      </div>
    </div>
  );
}

async function AgendaTab({ matterId, base }: { matterId: number; base: string }) {
  const rows = await db
    .select(eventSelect)
    .from(events)
    .leftJoin(matters, eq(matters.id, events.matterId))
    .leftJoin(users, eq(users.id, events.assignedId))
    .where(eq(events.matterId, matterId))
    .orderBy(asc(events.completed), asc(events.startsAt));

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <h2 className="font-serif text-lg font-semibold">Plazos y eventos</h2>
        <Link
          href={`/agenda/nuevo?expediente=${matterId}&returnTo=${encodeURIComponent(`${base}?tab=agenda`)}`}
          className="btn-primary btn-sm"
        >
          Añadir
        </Link>
      </div>
      <EventsList rows={rows} returnTo={`${base}?tab=agenda`} showMatter={false} empty="Este expediente no tiene eventos ni plazos" />
    </section>
  );
}
