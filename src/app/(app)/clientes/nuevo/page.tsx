import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Nuevo cliente" />
      <ClientForm action={createClientAction} cancelHref="/clientes" />
    </>
  );
}
