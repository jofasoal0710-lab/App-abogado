import type { Metadata } from "next";
import { RegistryPanel } from "../../registros/registry-panel";
import { CitationsPanel } from "../../normativa/citations-panel";
import { listMatterWritings } from "@/lib/writings";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { ReadBeacon } from "@/components/read-beacon";
import { Badge, EmptyState, Field, PageHeader, Stat } from "@/components/ui";
import { db } from "@/db";
import { documents, events, invoices, matterAccessLog, matterMembers, readAudit, matterNotes, matters, clients, roles, timeEntries, users } from "@/db/schema";
import { eventSelect } from "@/lib/agenda-data";
import { listAddableUsers, matterAccessSql } from "@/lib/access";
import { canManageMatterAccess } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { areaLabels, billingTypeLabels, entries, invoiceStatusLabels, matterStatusLabels } from "@/lib/labels";
import { formatDuration, formatMoney, invoiceTotals } from "@/lib/money";
import { DocumentsTable } from "../../documentos/documents-table";
import { UploadForm } from "../../documentos/upload-form";
import { EventsList } from "../../agenda/events-list";
import { TimeEntriesTable } from "../../horas/time-entries-table";
import { TimeEntryForm } from "../../horas/time-entry-form";
import { addNoteAction, changeStatusAction, deleteMatterAction, deleteNoteAction } from "../actions";
import { addMemberAction, removeMemberAction, setVisibilityAction } from "../access-actions";
import { READ_VERBS } from "@/lib/read-audit";
import { BillingTab } from "./billing-tab";

export const metadata: Metadata = { title: "Expediente" };

const TABS = [
  ["resumen", "Resumen"],
  ["notas", "Notas"],
  ["escritos", "Escritos"],
  ["documentos", "Documentos"],
  ["normativa", "Normativa"],
  ["registros", "Registros"],
  ["horas", "Horas"],
  ["agenda", "Agenda"],
  ["cobro", "Cobro"],
  ["facturas", "Facturas"],
  ["acceso", "Acceso"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function MatterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string; nuevo?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const tab: Tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as Tab) : "resumen";
  const seesBilling = can(user, "facturacion.ver");

  const [row] = await db
    .select({ matter: matters, client: clients, responsible: users.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .leftJoin(users, eq(users.id, matters.responsibleId))
    .where(and(eq(matters.id, id), matterAccessSql(user, matters.id)))
    .limit(1);
  if (!row) notFound(); // 404 también si existe pero no tienes acceso
  const { matter, client } = row;
  const canManage = canManageMatterAccess(user, matter);

  // Estadísticas económicas (siempre visibles en la cabecera).
  const [pending] = await db
    .select({
      minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int`,
      cents: sql<number>`coalesce(sum(round(${timeEntries.minutes} * ${timeEntries.rateCents} / 60.0)), 0)::float8`,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.matterId, id), eq(timeEntries.billable, true), isNull(timeEntries.invoiceId)));

  const matterInvoices = await db.query.invoices.findMany({
    where: eq(invoices.matterId, id),
    with: { items: true, payments: true },
    orderBy: desc(invoices.issueDate),
  });
  // «Facturado» y «cobrado» cuentan solo lo emitido (los borradores no son facturas todavía); las rectificativas
  // emitidas restan. Para no facturar dos veces los honorarios fijos, los borradores normales sí cuentan.
  const active = matterInvoices.filter((i) => i.status === "emitida" || i.status === "pagada");
  const forFixedFee = matterInvoices.filter((i) => i.status !== "anulada" && !(i.kind === "rectificativa" && i.status === "borrador"));
  const invoicedCents = active.reduce((s, i) => s + invoiceTotals(i.items, i.taxRate, i.withholdingRate).totalCents, 0);
  const invoicedSubtotal = forFixedFee.reduce((s, i) => s + invoiceTotals(i.items, i.taxRate, i.withholdingRate).subtotalCents, 0);
  const paidCents = active.reduce((s, i) => s + i.payments.reduce((p, x) => p + x.amountCents, 0), 0);
  const toInvoiceCents =
    matter.billingType === "tarifa_fija" ? Math.max(0, (matter.fixedFeeCents ?? 0) - invoicedSubtotal) : pending.cents;

  const base = `/expedientes/${id}`;
  return (
    <>
      {matter.visibility !== "abierto" && (
        <ReadBeacon key={tab} matterId={id} kind="ficha" detail={`${matter.number} · ${TABS.find(([t]) => t === tab)?.[1]}`} />
      )}
      <PageHeader
        title={matter.title}
        subtitle={
          <>
            {matter.number} · <Link className="link" href={`/clientes/${client.id}`}>{client.name}</Link> · {areaLabels[matter.area]}
            {matter.visibility === "restringido" && <span className="badge-amber ml-2">Restringido</span>}
            {matter.visibility === "confidencial" && <span className="badge-red ml-2">Confidencial</span>}
          </>
        }
        actions={
          <>
            <Link href={`${base}/editar`} className="btn-secondary">
              Editar
            </Link>
            {can(user, "expedientes.borrar") && (
              <form action={deleteMatterAction.bind(null, id)}>
                <ConfirmButton message="¿Eliminar el expediente con sus notas, horas, eventos y documentos? No se puede deshacer.">
                  Eliminar
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />

      {sp.error === "last_holder" && (
        <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No se puede quitar a la última persona activa con acceso a un expediente confidencial: nadie podría gestionarlo. Añade antes a otra persona.
        </p>
      )}
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
        {seesBilling && (
          <>
            <Stat label="Facturado (total a pagar)" value={formatMoney(invoicedCents)} hint={`${active.length} ${active.length === 1 ? "factura" : "facturas"}`} />
            <Stat
              label="Pendiente de cobro"
              value={formatMoney(Math.max(0, invoicedCents - paidCents))}
              tone={invoicedCents - paidCents > 0 ? "warn" : "default"}
              hint={`Cobrado: ${formatMoney(paidCents)}`}
            />
          </>
        )}
      </div>

      <nav className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Secciones del expediente">
        {TABS.filter(([key]) => (key !== "facturas" && key !== "cobro") || seesBilling).map(([key, label]) => (
          <Link
            key={key}
            href={key === "resumen" ? base : `${base}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
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
              value={`${billingTypeLabels[matter.billingType]}${matter.billingType === "tarifa_fija" && matter.fixedFeeCents ? ` · ${formatMoney(matter.fixedFeeCents)}` : ""}${matter.billingType === "por_horas" && matter.hourlyRateCents ? ` · ${formatMoney(matter.hourlyRateCents)}/h` : ""}`}
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

      {tab === "notas" && <NotesTab matterId={id} userId={user.id} canDeleteAll={can(user, "notas.borrar_todas")} />}

      {tab === "escritos" && <WritingsTab matterId={id} justCreated={sp.nuevo === "1"} />}

      {tab === "documentos" && <DocumentsTab matterId={id} user={user} />}

      {tab === "normativa" && <CitationsPanel matterId={id} />}

      {tab === "registros" && <RegistryPanel target={{ matterId: id }} defaultReference="" defaultKind="finca" userId={user.id} />}

      {tab === "horas" && <HoursTab matterId={id} user={user} matterRate={matter.billingType === "por_horas" ? matter.hourlyRateCents : null} />}

      {tab === "agenda" && <AgendaTab matterId={id} base={base} />}

      {tab === "acceso" && <AccessTab matter={matter} responsibleName={row.responsible} canManage={canManage} />}

      {tab === "cobro" && seesBilling && <BillingTab matter={matter} canEmit={can(user, "facturacion.emitir")} defaultRateCents={user.hourlyRateCents} />}

      {tab === "facturas" && seesBilling && (
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h2 className="font-serif text-lg font-semibold">Facturas del expediente</h2>
            {can(user, "facturacion.emitir") && (
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
                    <td className="text-right tabular-nums">{formatMoney(invoiceTotals(inv.items, inv.taxRate, inv.withholdingRate).totalCents)}</td>
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

async function NotesTab({ matterId, userId, canDeleteAll }: { matterId: number; userId: number; canDeleteAll: boolean }) {
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
                  {(canDeleteAll || n.authorId === userId) && (
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

async function HoursTab({ matterId, user, matterRate }: { matterId: number; user: Awaited<ReturnType<typeof requireUser>>; matterRate: number | null }) {
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
      <TimeEntryForm matterId={matterId} defaultRateCents={matterRate ?? user.hourlyRateCents} />
      <div className="card">
        <TimeEntriesTable rows={rows} user={user} showMatter={false} returnTo={`/expedientes/${matterId}?tab=horas`} />
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

async function AccessTab({
  matter,
  responsibleName,
  canManage,
}: {
  matter: typeof matters.$inferSelect;
  responsibleName: string | null;
  canManage: boolean;
}) {
  const addedBy = alias(users, "added_by");
  const [members, addable, log, reads] = await Promise.all([
    db
      .select({ userId: matterMembers.userId, name: users.name, roleName: roles.name, createdAt: matterMembers.createdAt, addedBy: addedBy.name })
      .from(matterMembers)
      .innerJoin(users, eq(users.id, matterMembers.userId))
      .innerJoin(roles, eq(roles.id, users.roleId))
      .leftJoin(addedBy, eq(addedBy.id, matterMembers.addedById))
      .where(eq(matterMembers.matterId, matter.id))
      .orderBy(asc(users.name)),
    canManage ? listAddableUsers(matter.id, matter.responsibleId) : Promise.resolve([]),
    canManage
      ? db
          .select({ id: matterAccessLog.id, detail: matterAccessLog.detail, createdAt: matterAccessLog.createdAt, actor: users.name })
          .from(matterAccessLog)
          .leftJoin(users, eq(users.id, matterAccessLog.actorId))
          .where(eq(matterAccessLog.matterId, matter.id))
          .orderBy(desc(matterAccessLog.createdAt), desc(matterAccessLog.id))
          .limit(30)
      : Promise.resolve([]),
    canManage && matter.visibility !== "abierto"
      ? db
          .select({ id: readAudit.id, kind: readAudit.kind, detail: readAudit.detail, createdAt: readAudit.createdAt, who: users.name })
          .from(readAudit)
          .leftJoin(users, eq(users.id, readAudit.userId))
          .where(eq(readAudit.matterId, matter.id))
          .orderBy(desc(readAudit.createdAt), desc(readAudit.id))
          .limit(50)
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <section className="card card-pad">
        <h2 className="mb-1 font-serif text-lg font-semibold">Visibilidad</h2>
        <p className="mb-4 text-sm text-ink-600">
          {matter.visibility === "confidencial"
            ? "Confidencial: solo lo ven el responsable y los miembros de la lista. Ni siquiera los administradores, salvo que sean responsable o miembros. El resto del equipo no sabe que existe."
            : matter.visibility === "restringido"
              ? "Restringido: solo lo ven el responsable, los miembros de la lista y los administradores. El resto del equipo ni siquiera sabe que existe."
              : "Abierto: lo ve todo el equipo. Los miembros de la lista solo se tienen en cuenta si lo restringes."}
        </p>
        {canManage ? (
          <ActionForm action={setVisibilityAction.bind(null, matter.id)}>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Visibilidad" className="w-80">
                <select className="input" name="visibility" defaultValue={matter.visibility}>
                  <option value="abierto">Abierto (todo el equipo)</option>
                  <option value="restringido">Restringido (miembros y administradores)</option>
                  <option value="confidencial">Confidencial (ni los administradores)</option>
                </select>
              </Field>
              <SubmitButton>Guardar</SubmitButton>
            </div>
            <p className="hint mt-2">
              Al restringirlo, quien no sea miembro dejará de verlo y los eventos pendientes que tuviera asignados pasarán al responsable. Para hacerlo confidencial hace falta un responsable activo y que tú seas responsable o miembro (los administradores deben añadirse antes como miembro).
            </p>
          </ActionForm>
        ) : (
          <p className="text-sm text-ink-500">Solo los administradores y el responsable pueden cambiarla.</p>
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Quién tiene acceso</h2>
        <ul className="divide-y divide-ink-100 text-sm">
          <li className="flex items-center justify-between px-5 py-3">
            <span>
              <strong className="text-ink-900">{responsibleName ?? "Sin responsable"}</strong>
              <span className="ml-2 text-ink-500">Responsable</span>
            </span>
          </li>
          <li className="px-5 py-3 text-ink-600">
            {matter.visibility === "confidencial"
              ? "Los administradores NO tienen acceso por su rol: solo si figuran como responsable o miembros."
              : "Los administradores siempre tienen acceso."}
          </li>
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-5 py-3">
              <span>
                <strong className="text-ink-900">{m.name}</strong>
                <span className="ml-2 text-ink-500">
                  {m.roleName} · miembro desde {formatDate(m.createdAt)}
                  {m.addedBy && ` · añadido/a por ${m.addedBy}`}
                </span>
              </span>
              {canManage && (
                <form action={removeMemberAction.bind(null, matter.id, m.userId)}>
                  <ConfirmButton message={`¿Quitar a ${m.name} del expediente?`} className="btn-ghost btn-sm text-red-700">
                    Quitar
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
          {members.length === 0 && <li className="px-5 py-3 text-ink-500">No hay miembros añadidos.</li>}
        </ul>
        {canManage && (
          <ActionForm action={addMemberAction.bind(null, matter.id)} resetOnSuccess>
            <div className="flex flex-wrap items-end gap-3 border-t border-ink-100 px-5 py-4">
              <Field label="Añadir miembro" className="w-72">
                <select className="input" name="userId" defaultValue="" required>
                  <option value="" disabled>
                    Selecciona una persona…
                  </option>
                  {addable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleName})
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton>Añadir</SubmitButton>
            </div>
          </ActionForm>
        )}
      </section>

      {canManage && (
        <section className="card overflow-x-auto">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Historial de cambios de acceso</h2>
          {log.length === 0 ? (
            <EmptyState title="Sin cambios registrados" />
          ) : (
            <table className="table">
              <tbody>
                {log.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td>{l.detail}</td>
                    <td className="text-ink-500">{l.actor ?? "Usuario eliminado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {canManage && matter.visibility !== "abierto" && (
        <section className="card overflow-x-auto">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Lecturas recientes (últimas 50)</h2>
          {reads.length === 0 ? (
            <EmptyState title="Aún no se ha registrado ninguna lectura">Se registran las aperturas de la ficha y las descargas de documentos.</EmptyState>
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
          <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
            Un mismo acceso repetido en menos de 10 minutos se anota una sola vez. Las lecturas se conservan indefinidamente.
          </p>
        </section>
      )}
    </div>
  );
}

async function WritingsTab({ matterId, justCreated }: { matterId: number; justCreated: boolean }) {
  const rows = await listMatterWritings(matterId);
  return (
    <div className="space-y-4">
      {justCreated && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
          <div>
            <p className="font-medium text-brand-900">Expediente creado.</p>
            <p className="text-sm text-brand-800">¿Generas ahora su primer escrito? Los datos del cliente y del expediente se rellenan solos.</p>
          </div>
          <Link href={`/formularios?expediente=${matterId}`} className="btn-primary">
            Generar escrito
          </Link>
        </div>
      )}
      <section className="card">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold">Escritos del expediente</h2>
          <Link href={`/formularios?expediente=${matterId}`} className="btn-primary btn-sm">
            Generar escrito
          </Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Aún no hay escritos">Genera uno desde los formularios: demanda, contestación, recursos…</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link href={`/escritos/${w.id}`} className="link">
                    {w.title}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {w.kind === "escritura" ? "Escritura notarial" : "Escrito"} · {w.author ?? "—"} · {formatDateTime(w.updatedAt)}
                  </p>
                </div>
                <span className="flex gap-1">
                  <Link href={`/escritos/${w.id}/editar`} className="btn-ghost btn-sm">
                    Corregir
                  </Link>
                  <a href={`/api/escritos/${w.id}/doc`} className="btn-ghost btn-sm">
                    Word
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
