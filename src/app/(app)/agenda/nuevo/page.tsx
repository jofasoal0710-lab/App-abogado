import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { eventFormOptions } from "@/lib/agenda-data";
import { safeNext } from "@/lib/safe-redirect";
import { createEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Nuevo evento" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ expediente?: string; returnTo?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const options = await eventFormOptions();
  const matterId = Number(sp.expediente) || undefined;
  const returnTo = safeNext(sp.returnTo, matterId ? `/expedientes/${matterId}?tab=agenda` : "/agenda");

  return (
    <>
      <PageHeader title="Nuevo evento o plazo" />
      <EventForm
        action={createEventAction}
        matters={options.matters}
        users={options.users}
        defaultMatterId={matterId}
        defaultAssignedId={user.id}
        returnTo={returnTo}
      />
    </>
  );
}
