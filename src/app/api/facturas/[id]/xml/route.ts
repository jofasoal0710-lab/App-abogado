import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { einvoices, invoices } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logRead } from "@/lib/read-audit";

export const dynamic = "force-dynamic";

/** XML firmado de un comprobante electrónico (o la respuesta de Hacienda). Mismo acceso que la factura. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (!can(user, "facturacion.ver")) return new Response("No tienes permiso para ver facturas.", { status: 403 });

  const id = Number((await ctx.params).id);
  const url = new URL(req.url);
  const eid = Number(url.searchParams.get("e"));
  const response = url.searchParams.get("tipo") === "respuesta";
  if (!Number.isInteger(id) || !Number.isInteger(eid)) return new Response("No encontrado", { status: 404 });

  const [row] = await db
    .select({ e: einvoices, matterId: invoices.matterId, clientId: invoices.clientId })
    .from(einvoices)
    .innerJoin(invoices, eq(invoices.id, einvoices.invoiceId))
    .where(and(eq(einvoices.id, eid), eq(einvoices.invoiceId, id), invoiceAccessSql(user)));
  const xml = row && (response ? row.e.responseXml : row.e.signedXml);
  if (!row || !xml) return new Response("No encontrado", { status: 404 });

  const detail = `XML ${response ? "respuesta " : ""}${row.e.consecutive}`;
  await logRead(user, row.matterId ? { matterId: row.matterId, kind: "factura", detail } : { clientId: row.clientId, kind: "factura", detail });

  const name = `${row.e.clave}${response ? "-respuesta" : ""}.xml`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
