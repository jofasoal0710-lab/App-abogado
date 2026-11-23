import { feedForToken } from "@/lib/calendar-feed";
import { buildIcs, toIcsEvent } from "@/lib/hearings";
import { getReminderConfig } from "@/lib/reminders/config";

export const dynamic = "force-dynamic";

/**
 * Suscripción de calendario (Google Calendar, Outlook, Apple): estas apps no pueden iniciar sesión, así que
 * el enlace lleva un token secreto propio de la persona; se revoca o se cambia en «Mi cuenta».
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const feed = await feedForToken(token);
  if (!feed) return new Response("Enlace no válido o revocado", { status: 404 });
  const appUrl = getReminderConfig().appUrl;
  const ics = buildIcs(feed.rows.map((r) => toIcsEvent(r, appUrl)), `Agenda de ${feed.name}`);
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
