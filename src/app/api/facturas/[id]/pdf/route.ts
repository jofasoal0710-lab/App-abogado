import { and, eq } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { invoicePdfResponse, loadInvoiceForPdf } from "@/lib/invoice-pdf-response";
import { logRead } from "@/lib/read-audit";

export const dynamic = "force-dynamic";

/** PDF de una factura. Mismo acceso que la ficha: 404 si no existe o pertenece a un expediente/cliente que no ves. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!can(user, "facturacion.ver")) return new Response("No tienes permiso para ver facturas.", { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });

  const inv = await loadInvoiceForPdf(and(eq(invoices.id, id), invoiceAccessSql(user)));
  if (!inv) return new Response("No encontrado", { status: 404 });

  const label = inv.number ?? `Borrador #${inv.id}`;
  // Descargar el PDF cuenta como lectura en expedientes restringidos/confidenciales y clientes confidenciales.
  await logRead(user, inv.matterId ? { matterId: inv.matterId, kind: "factura", detail: `PDF ${label}` } : { clientId: inv.clientId, kind: "factura", detail: `PDF ${label}` });

  return invoicePdfResponse(inv);
}
