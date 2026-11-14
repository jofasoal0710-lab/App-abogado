import { timingSafeEqual } from "node:crypto";
import { getReminderConfig } from "@/lib/reminders/config";
import { runReminders } from "@/lib/reminders/runner";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Ejecuta los recordatorios. Pensado para un cron externo:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/cron/recordatorios
 * Es idempotente: se puede llamar varias veces al día.
 */
export async function POST(request: Request) {
  const { cronSecret } = getReminderConfig();
  // Sin secreto configurado el endpoint queda desactivado (nunca abierto).
  if (cronSecret.length < 16) {
    return Response.json({ error: "CRON_SECRET no está configurado (mínimo 16 caracteres)." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!safeEqual(token, cronSecret)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await runReminders();
  return Response.json(result, { status: result.status === "skipped" ? 503 : 200 });
}
