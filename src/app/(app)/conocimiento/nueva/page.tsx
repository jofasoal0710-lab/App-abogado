import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createKnowledgeAction } from "../actions";
import { KnowledgeForm } from "../knowledge-form";

export const metadata: Metadata = { title: "Nueva entrada de conocimiento" };

export default async function NewKnowledgePage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nueva entrada" subtitle="Lo que escribas aquí lo usará el asistente para responder al equipo." />
      <KnowledgeForm action={createKnowledgeAction} submitLabel="Guardar entrada" />
    </>
  );
}
