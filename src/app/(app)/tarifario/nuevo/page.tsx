import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { createServiceAction } from "../actions";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Nuevo servicio" };

export default async function NewServicePage() {
  await requirePermission("facturacion.emitir");
  return (
    <>
      <PageHeader title="Nuevo servicio" subtitle="Un proceso o servicio del despacho y cómo se cobra." />
      <ServiceForm action={createServiceAction} />
    </>
  );
}
