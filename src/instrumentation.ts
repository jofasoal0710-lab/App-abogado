// Fija la zona horaria del proceso: las horas de la agenda se introducen y se muestran
// en la hora local del despacho, independientemente de dónde esté alojado el servidor.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.APP_TIMEZONE ?? "Europe/Madrid";
  }
}
