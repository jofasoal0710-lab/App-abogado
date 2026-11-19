import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Nuevo cliente" />
      <ClientForm action={createClientAction} canSetConfidential={can(user, "clientes.gestionar")} cancelHref="/clientes" />
    </>
  );
}
