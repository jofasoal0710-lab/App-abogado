import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { feeServices } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { updateServiceAction } from "../../actions";
import { ServiceForm } from "../../service-form";

export const metadata: Metadata = { title: "Corregir servicio" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("facturacion.emitir");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [service] = await db.select().from(feeServices).where(eq(feeServices.id, id)).limit(1);
  if (!service) notFound();
  return (
    <>
      <PageHeader title={`Corregir: ${service.name}`} />
      <ServiceForm action={updateServiceAction.bind(null, id)} service={service} />
    </>
  );
}
