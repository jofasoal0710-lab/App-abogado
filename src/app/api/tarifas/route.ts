import { getCurrentUser } from "@/lib/auth";
import { guideData } from "@/lib/tariff";

export const dynamic = "force-dynamic";

/** Guía de tarifas (ventana de ayuda): tarifario del despacho y ajuste del arancel. Solo con sesión. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json(await guideData(), { headers: { "cache-control": "private, no-store" } });
}
