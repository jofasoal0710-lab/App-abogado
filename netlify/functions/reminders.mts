// Función programada de Netlify: dispara los recordatorios por correo.
//
// Netlify solo ejecuta las funciones programadas en el deploy de PRODUCCIÓN, y siempre en UTC.
// Para no depender del horario de verano, se ejecuta cada hora y es el endpoint quien decide, según
// la hora local del despacho (REMINDER_HOUR / APP_TIMEZONE), si ya toca. Es idempotente: ejecutarlo
// varias veces al día no duplica ningún aviso.
export default async () => {
  const base = (process.env.APP_URL || process.env.URL || "").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.log("[recordatorios] Falta APP_URL (o URL) o CRON_SECRET: no se hace nada.");
    return;
  }
  try {
    const res = await fetch(`${base}/api/cron/recordatorios?respectHour=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    console.log(`[recordatorios] HTTP ${res.status}: ${body.slice(0, 300)}`);
  } catch (err) {
    console.error("[recordatorios] No se pudo llamar al endpoint:", err);
  }
};

export const config = { schedule: "0 * * * *" };
