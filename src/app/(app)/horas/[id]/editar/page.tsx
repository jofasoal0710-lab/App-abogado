import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters, timeEntries } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { safeNext } from "@/lib/safe-redirect";
import { updateTimeEntryAction } from "../../actions";
import { TimeEntryForm } from "../../time-entry-form";

export const metadata: Metadata = { title: "Corregir horas" };

/** Corregir una entrada de horas mal escrita. Solo la suya (o con permiso) y si aún no está facturada. */
export default async function EditTimeEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const back = safeNext((await searchParams).volver ?? "/horas");

  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id), matterAccessSql(user, timeEntries.matterId)))
    .limit(1);
  if (!entry) notFound();
  const editable = entry.invoiceId === null && (entry.userId === user.id || can(user, "horas.borrar_todas"));

  const options = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(and(or(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), eq(matters.id, entry.matterId)), matterAccessSql(user, matters.id)))
    .orderBy(asc(clients.name), asc(matters.number));

  return (
    <>
      <PageHeader
        title="Corregir horas"
        subtitle="Cambia lo que se escribió mal y guarda. Si sobra la entrada entera, bórrala desde la lista."
        actions={
          <Link href={back} className="btn-secondary">
            Volver
          </Link>
        }
      />
      {editable ? (
        <TimeEntryForm
          matterOptions={options.map((m) => ({ id: m.id, label: `${m.number} · ${m.title} (${m.client})` }))}
          defaultRateCents={user.hourlyRateCents}
          entry={entry}
          action={updateTimeEntryAction.bind(null, entry.id)}
        />
      ) : (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {entry.invoiceId !== null
            ? "Esta entrada ya está facturada y no se puede cambiar. Si hay un error, corrígelo con una factura rectificativa."
            : "Solo quien registró estas horas (o quien tenga permiso para gestionar las de otras personas) puede corregirlas."}
        </p>
      )}
    </>
  );
}
