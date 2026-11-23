import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getAccessibleMatter } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { eventFormOptions } from "@/lib/agenda-data";
import { safeNext } from "@/lib/safe-redirect";
import { createEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Nuevo evento" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ expediente?: string; returnTo?: string; tipo?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const options = await eventFormOptions(user);
  const requested = Number(sp.expediente) || undefined;
  const matterId = requested && (await getAccessibleMatter(user, requested)) ? requested : undefined;
  const returnTo = safeNext(sp.returnTo, matterId ? `/expedientes/${matterId}?tab=agenda` : "/agenda");

  return (
    <>
      <PageHeader title={sp.tipo === "audiencia" ? "Nueva audiencia" : "Nuevo evento o plazo"} />
      <EventForm
        action={createEventAction}
        matters={options.matters}
        users={options.users}
        defaultMatterId={matterId}
        defaultAssignedId={user.id}
        defaultKind={sp.tipo === "audiencia" || sp.tipo === "reunion" || sp.tipo === "tarea" ? sp.tipo : undefined}
        returnTo={returnTo}
      />
    </>
  );
}
