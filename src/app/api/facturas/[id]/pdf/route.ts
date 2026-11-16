import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { logRead } from "@/lib/read-audit";

export const dynamic = "force-dynamic";

/** PDF de una factura. Mismo acceso que la ficha: 404 si no existe o pertenece a un expediente/cliente que no ves. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("No encontrado", { status: 404 });

  const inv = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), invoiceAccessSql(user)),
    with: {
      client: true,
      matter: true,
      rectifies: true,
      items: { orderBy: (i) => asc(i.id) },
      rectifications: { where: (r) => eq(r.status, "emitida"), orderBy: (r) => asc(r.id) },
    },
  });
  if (!inv) return new Response("No encontrado", { status: 404 });

  const label = inv.number ?? `Borrador #${inv.id}`;
  // Descargar el PDF cuenta como lectura en expedientes restringidos/confidenciales y clientes confidenciales.
  await logRead(user, inv.matterId ? { matterId: inv.matterId, kind: "factura", detail: `PDF ${label}` } : { clientId: inv.clientId, kind: "factura", detail: `PDF ${label}` });

  const pdf = await buildInvoicePdf({
    firm: { name: config.firmName, taxId: config.firmTaxId, address: config.firmAddress },
    invoice: {
      number: inv.number,
      status: inv.status,
      kind: inv.kind,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      taxRate: inv.taxRate,
      withholdingRate: inv.withholdingRate,
      notes: inv.notes,
      rectificationReason: inv.rectificationReason,
    },
    client: { name: inv.client.name, taxId: inv.client.taxId, address: inv.client.address },
    matter: inv.matter ? { number: inv.matter.number, title: inv.matter.title } : null,
    items: inv.items,
    rectifies: inv.rectifies ? { number: inv.rectifies.number, issueDate: inv.rectifies.issueDate } : null,
    rectifiedBy: inv.rectifications.flatMap((r) => (r.number ? [r.number] : [])),
  });

  const fileName = `${(inv.number ?? `borrador-${inv.id}`).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
