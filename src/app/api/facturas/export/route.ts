import { getCurrentUser, canManageInvoices } from "@/lib/auth";
import { ISO, loadRegister, registerToCsv } from "@/lib/invoice-register";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** CSV del libro de facturas emitidas. Solo administradores y abogados; solo lo que el usuario puede ver. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!canManageInvoices(user)) return new Response("No tienes permiso para exportar facturas.", { status: 403 });

  const today = todayISO();
  const sp = new URL(request.url).searchParams;
  const from = sp.get("desde") ?? `${today.slice(0, 4)}-01-01`;
  const to = sp.get("hasta") ?? today;
  if (!ISO.test(from) || !ISO.test(to) || from > to) return new Response("Rango de fechas no válido.", { status: 400 });

  const { rows, truncated } = await loadRegister(user, from, to, today);
  if (truncated) return new Response("Demasiadas facturas en el rango: reduce el periodo.", { status: 413 });

  return new Response(registerToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="libro-facturas_${from}_${to}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
