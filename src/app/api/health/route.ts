export const dynamic = "force-dynamic";

/**
 * Comprobación de salud para la plataforma de alojamiento (y para un "pinger" que mantenga despierto
 * el plan gratuito de Render). Deliberadamente no toca la base de datos ni expone nada.
 */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
