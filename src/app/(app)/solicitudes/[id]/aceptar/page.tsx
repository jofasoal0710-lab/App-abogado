import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { intakeRequests, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatId } from "@/lib/cr-id";
import { todayISO } from "@/lib/dates";
import { findConflicts } from "@/lib/intake-db";
import { can } from "@/lib/permissions";
import { acceptIntakeAction } from "../../actions";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Aceptar solicitud" };

export default async function AcceptIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("solicitudes.gestionar");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [req] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id));
  if (!req) notFound();
  if (req.status !== "pendiente") redirect(`/solicitudes/${id}`);
  const [hits, lawyers] = await Promise.all([findConflicts(user, req), db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name))]);
  // Clientes que coinciden y que puedes ver: se ofrecen para no duplicar la ficha.
  const matches = hits
    .filter((h) => h.kind === "cliente" && h.clientId)
    .map((h) => ({ id: h.clientId!, name: h.clientName! }));

  return (
    <>
      <Breadcrumbs items={[{ label: "Solicitudes", href: "/solicitudes" }, { label: req.name, href: `/solicitudes/${id}` }, { label: "Aceptar" }]} />
      <PageHeader title="Aceptar la solicitud" subtitle="Se crea el cliente (o se usa el que ya existe), se abre el expediente y se guarda la constancia de la revisión de conflictos." />
      <AcceptForm
        action={acceptIntakeAction.bind(null, id)}
        req={{
          id,
          clientType: req.clientType,
          name: req.name,
          idType: req.idType,
          taxId: req.taxId ? formatId(req.idType, req.taxId) : "",
          birthDate: req.birthDate ?? "",
          maritalStatus: req.maritalStatus,
          email: req.email,
          phone: req.phone,
          address: req.address ?? "",
          area: req.area,
          opposingParty: req.opposingParty ?? "",
          summary: req.summary,
        }}
        matches={matches}
        lawyers={lawyers}
        defaultResponsibleId={can(user, "facturacion.emitir") && !can(user, "equipo.gestionar") ? user.id : undefined}
        conflictCount={hits.length}
        canSetConfidential={can(user, "clientes.gestionar")}
        today={todayISO()}
      />
    </>
  );
}
