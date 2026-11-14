import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { createMatterAction } from "../actions";
import { MatterForm } from "../matter-form";

export const metadata: Metadata = { title: "Nuevo expediente" };

export default async function NewMatterPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const user = await requireUser();
  const { cliente } = await searchParams;
  const [allClients, lawyers] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
  ]);

  return (
    <>
      <PageHeader title="Nuevo expediente" />
      <MatterForm
        action={createMatterAction}
        clients={allClients}
        lawyers={lawyers}
        defaultClientId={Number(cliente) || undefined}
        defaultResponsibleId={user.role === "abogado" ? user.id : undefined}
        cancelHref="/expedientes"
      />
    </>
  );
}
