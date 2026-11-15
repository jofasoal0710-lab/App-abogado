import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events } from "@/db/schema";
import { canAccessEvent } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { eventFormOptions } from "@/lib/agenda-data";
import { safeNext } from "@/lib/safe-redirect";
import { updateEventAction } from "../../actions";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await canAccessEvent(user, id))) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const options = await eventFormOptions(user);
  const { returnTo } = await searchParams;

  return (
    <>
      <PageHeader title="Editar evento" />
      <EventForm
        action={updateEventAction.bind(null, event.id)}
        event={event}
        matters={options.matters}
        users={options.users}
        returnTo={safeNext(returnTo, "/agenda")}
      />
    </>
  );
}
