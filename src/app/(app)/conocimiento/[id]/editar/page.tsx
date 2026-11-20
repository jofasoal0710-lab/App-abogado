import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateKnowledgeAction } from "../../actions";
import { KnowledgeForm } from "../../knowledge-form";

export const metadata: Metadata = { title: "Corregir entrada" };

export default async function EditKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [e] = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, id));
  if (!e || (e.createdById !== user.id && !can(user, "equipo.gestionar"))) notFound();
  return (
    <>
      <PageHeader title={`Corregir: ${e.title}`} />
      <KnowledgeForm action={updateKnowledgeAction.bind(null, id)} entry={e} submitLabel="Guardar cambios" />
    </>
  );
}
