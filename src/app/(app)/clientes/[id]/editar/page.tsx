import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireClientPage } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const client = await requireClientPage(user, id);

  return (
    <>
      <PageHeader title={`Editar: ${client.name}`} />
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        client={client}
        cancelHref={`/clientes/${client.id}`}
      />
    </>
  );
}
