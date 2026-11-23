import { eq } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { invoicePdfResponse, loadInvoiceForPdf } from "@/lib/invoice-pdf-response";
import { getPortalSession } from "@/lib/portal";
import { portalInvoiceAllowed } from "@/lib/portal-data";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/** PDF de una factura del cliente desde su portal (solo emitidas o pagadas de expedientes compartidos). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getPortalSession();
  if (!s) return new Response("No autorizado", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !(await portalInvoiceAllowed(s.clientId, id))) return new Response("No encontrado", { status: 404 });
  const inv = await loadInvoiceForPdf(eq(invoices.id, id));
  if (!inv) return new Response("No encontrado", { status: 404 });
  const { ip } = await requestMeta();
  await logSecurityEvent("portal_descarga", { ip, detail: `${s.clientName} · factura ${inv.number}` });
  return invoicePdfResponse(inv);
}
