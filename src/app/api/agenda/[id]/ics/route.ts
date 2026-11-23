import { eq } from "drizzle-orm";
import { events } from "@/db/schema";
import { canAccessEvent } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { loadCalendarRows } from "@/lib/calendar-feed";
import { buildIcs, toIcsEvent } from "@/lib/hearings";
import { getReminderConfig } from "@/lib/reminders/config";

export const dynamic = "force-dynamic";

/** Un evento como fichero .ics para añadirlo al calendario del teléfono o del correo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await canAccessEvent(user, id))) return new Response("No existe", { status: 404 });
  const [row] = await loadCalendarRows(eq(events.id, id));
  if (!row) return new Response("No existe", { status: 404 });
  const ics = buildIcs([toIcsEvent(row, getReminderConfig().appUrl)], "Agenda del despacho");
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="evento-${id}.ics"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
