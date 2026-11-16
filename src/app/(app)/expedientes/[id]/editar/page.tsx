import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, users } from "@/db/schema";
import { clientAccessSql, requireMatterPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { canManageMatterAccess } from "@/lib/access-rules";
import { updateMatterAction } from "../../actions";
import { MatterForm } from "../../matter-form";

export const metadata: Metadata = { title: "Editar expediente" };

export default async function EditMatterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const matter = await requireMatterPage(user, id);

  const [allClients, lawyers] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(clientAccessSql(user, clients.id)).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);

  return (
    <>
      <PageHeader title={`Editar ${matter.number}`} />
      <MatterForm
        action={updateMatterAction.bind(null, matter.id)}
        matter={matter}
        clients={allClients}
        lawyers={lawyers}
        canChangeResponsible={canManageMatterAccess(user, matter)}
        cancelHref={`/expedientes/${matter.id}`}
      />
    </>
  );
}
