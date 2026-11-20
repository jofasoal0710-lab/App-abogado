import { getCurrentUser } from "@/lib/auth";
import { globalSearch } from "@/lib/global-search";

export const dynamic = "force-dynamic";

/** Búsqueda global (paleta Ctrl+K). Solo devuelve lo que la persona puede ver. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(await globalSearch(user, q), { headers: { "cache-control": "private, no-store" } });
}
