import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters, timeEntries, users } from "@/db/schema";
import { clientAccessSql, getAccessibleClient, getAccessibleMatter, matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { formatDuration, formatMoney, timeAmountCents } from "@/lib/money";
import { createInvoiceAction } from "../actions";

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ expediente?: string; cliente?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const matterId = Number(sp.expediente) || null;
  const clientParam = Number(sp.cliente) || null;

  if (!matterId && !clientParam) {
    // Paso 1: elegir expediente (lo habitual) o cliente (factura libre).
    const [openMatters, allClients] = await Promise.all([
      db
        .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
        .from(matters)
        .innerJoin(clients, eq(clients.id, matters.clientId))
        .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera", "cerrado"]), matterAccessSql(user, matters.id)))
        .orderBy(asc(clients.name), desc(matters.number)),
      db.select({ id: clients.id, name: clients.name }).from(clients).where(clientAccessSql(user, clients.id)).orderBy(asc(clients.name)),
    ]);
    return (
      <>
        <PageHeader title="Nueva factura" subtitle="¿Qué quieres facturar?" />
        <div className="grid gap-6 md:grid-cols-2">
          <form className="card card-pad space-y-3">
            <h2 className="font-serif text-lg font-semibold">Desde un expediente</h2>
            <p className="text-sm text-ink-500">Se propondrán las horas facturables pendientes y los honorarios fijos.</p>
            <select className="input" name="expediente" required defaultValue="">
              <option value="" disabled>
                Selecciona un expediente…
              </option>
              {openMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.number} · {m.client} · {m.title}
                </option>
              ))}
            </select>
            <button className="btn-primary">Continuar</button>
          </form>
          <form className="card card-pad space-y-3">
            <h2 className="font-serif text-lg font-semibold">Factura libre a un cliente</h2>
            <p className="text-sm text-ink-500">Para conceptos que no proceden de horas (suplidos, provisiones de fondos…).</p>
            <select className="input" name="cliente" required defaultValue="">
              <option value="" disabled>
                Selecciona un cliente…
              </option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn-secondary">Continuar</button>
          </form>
        </div>
      </>
    );
  }

  // Paso 2: datos de la factura.
  let clientId = clientParam;
  let matter: typeof matters.$inferSelect | undefined;
  if (matterId) {
    matter = (await getAccessibleMatter(user, matterId)) ?? undefined;
    if (!matter) notFound();
    clientId = matter.clientId;
  }
  const client = await getAccessibleClient(user, clientId!);
  if (!client) notFound();

  const pending = matter
    ? await db
        .select({
          id: timeEntries.id,
          workedOn: timeEntries.workedOn,
          minutes: timeEntries.minutes,
          rateCents: timeEntries.rateCents,
          description: timeEntries.description,
          userName: users.name,
        })
        .from(timeEntries)
        .innerJoin(users, eq(users.id, timeEntries.userId))
        .where(and(eq(timeEntries.matterId, matter.id), eq(timeEntries.billable, true), isNull(timeEntries.invoiceId)))
        .orderBy(asc(timeEntries.workedOn), asc(timeEntries.id))
    : [];

  const today = todayISO();
  const fixedFee = matter?.billingType === "tarifa_fija" ? matter.fixedFeeCents : null;

  return (
    <>
      <PageHeader
        title="Nueva factura"
        subtitle={matter ? `${matter.number} · ${matter.title} · ${client.name}` : `Cliente: ${client.name}`}
      />
      <ActionForm action={createInvoiceAction} className="space-y-6">
        <input type="hidden" name="clientId" value={client.id} />
        {matter && <input type="hidden" name="matterId" value={matter.id} />}

        <section className="card card-pad">
          <h2 className="mb-4 font-serif text-lg font-semibold">Datos de la factura</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Fecha">
              <input className="input" type="date" name="issueDate" defaultValue={today} required />
            </Field>
            <Field label="Vencimiento">
              <input className="input" type="date" name="dueDate" defaultValue={addDaysISO(today, 30)} />
            </Field>
            <Field label="IVA (%)">
              <input className="input" name="taxRate" inputMode="numeric" defaultValue={config.defaultTaxRate} required />
            </Field>
            <Field
              label="Retención IRPF (%)"
              hint={client.type === "empresa" ? "Se propone a empresas; ponla a 0 si no procede (p. ej. cliente extranjero)" : "A un particular no se le practica retención"}
            >
              <input className="input" name="withholdingRate" inputMode="numeric" defaultValue={client.type === "empresa" ? config.defaultWithholdingRate : 0} required />
            </Field>
            <Field label="Notas" className="sm:col-span-4">
              <input className="input" name="notes" maxLength={3000} placeholder="Forma de pago, IBAN, observaciones…" />
            </Field>
          </div>
        </section>

        {matter && (
          <section className="card">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Horas pendientes de facturar</h2>
            {pending.length === 0 ? (
              <EmptyState title="No hay horas facturables pendientes en este expediente" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-px" />
                    <th>Fecha</th>
                    <th>Trabajo</th>
                    <th>Abogado</th>
                    <th className="text-right">Tiempo</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input type="checkbox" name="entry" value={e.id} defaultChecked aria-label={`Incluir ${e.description}`} />
                      </td>
                      <td className="whitespace-nowrap">{formatDate(e.workedOn)}</td>
                      <td>{e.description}</td>
                      <td>{e.userName}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatDuration(e.minutes)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatMoney(timeAmountCents(e.minutes, e.rateCents))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {matter && matter.billingType === "tarifa_fija" && (
          <section className="card card-pad">
            <h2 className="mb-3 font-serif text-lg font-semibold">Honorarios fijos</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeFixedFee" />
              Incluir honorarios profesionales pactados
            </label>
            <Field label="Importe (sin IVA)" className="mt-3 max-w-xs">
              <input
                className="input"
                name="fixedFee"
                inputMode="decimal"
                defaultValue={fixedFee ? (fixedFee / 100).toFixed(2).replace(".", ",") : ""}
              />
            </Field>
          </section>
        )}

        <p className="text-sm text-ink-500">
          Se creará como <strong>borrador</strong>: podrás añadir o quitar líneas y revisarla antes de emitirla.
        </p>
        <SubmitButton pendingText="Creando…">Crear borrador</SubmitButton>
      </ActionForm>
    </>
  );
}
