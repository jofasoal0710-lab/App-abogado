import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { updateMatterAction } from "../../actions";
import { MatterForm } from "../../matter-form";

export const metadata: Metadata = { title: "Editar expediente" };

export default async function EditMatterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [matter] = await db.select().from(matters).where(eq(matters.id, id)).limit(1);
  if (!matter) notFound();

  const [allClients, lawyers] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
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
        cancelHref={`/expedientes/${matter.id}`}
      />
    </>
  );
}
