import { getReminderConfig } from "./config";
import { runReminders } from "./runner";

const CHECK_EVERY_MS = 15 * 60 * 1000;
const g = globalThis as unknown as { __reminderScheduler?: NodeJS.Timeout };

async function tick() {
  const { hour } = getReminderConfig();
  // Desde la hora configurada en adelante: si el servidor estuvo apagado a las 8:00,
  // el aviso se recupera en cuanto arranca. runReminders es idempotente.
  if (new Date().getHours() < hour) return;
  try {
    const r = await runReminders();
    if (r.status === "skipped") return; // SMTP sin configurar: silencio, se ve en /recordatorios
    if (r.remindersSent > 0 || r.emailsFailed > 0) {
      console.log(
        `[recordatorios] enviados ${r.remindersSent} aviso(s) en ${r.emailsSent} correo(s); fallos: ${r.emailsFailed}` +
          (r.errors.length ? ` — ${r.errors.join("; ")}` : ""),
      );
    }
  } catch (err) {
    console.error("[recordatorios] error en la ejecución programada:", err);
  }
}

/** Arranca el planificador interno (una sola vez por proceso). Solo para despliegues de una instancia. */
export function startReminderScheduler() {
  if (g.__reminderScheduler) return;
  g.__reminderScheduler = setInterval(tick, CHECK_EVERY_MS);
  g.__reminderScheduler.unref();
  setTimeout(tick, 30_000).unref(); // primera comprobación poco después de arrancar
  console.log(`[recordatorios] planificador activo (a partir de las ${getReminderConfig().hour}:00, hora local)`);
}
