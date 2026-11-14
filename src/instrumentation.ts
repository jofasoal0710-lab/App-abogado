// Fija la zona horaria del proceso: las horas de la agenda se introducen y se muestran
// en la hora local del despacho, independientemente de dónde esté alojado el servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.env.TZ = process.env.APP_TIMEZONE ?? "Europe/Madrid";

  if (process.env.REMINDERS_SCHEDULER === "true") {
    const { startReminderScheduler } = await import("./lib/reminders/scheduler");
    startReminderScheduler();
  }
}
