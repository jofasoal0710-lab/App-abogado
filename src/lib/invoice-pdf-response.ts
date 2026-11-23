import "server-only";
import { asc, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { config } from "./config";
import { DOC_TYPES, type DocType } from "./einvoice/build";
import { haciendaEnv } from "./einvoice/hacienda";
import { einvoiceStatusLabels } from "./einvoice/labels";
import { buildInvoicePdf } from "./invoice-pdf";

/** Carga una factura con todo lo que necesita su PDF (`where` ya incluye el control de acceso). */
export async function loadInvoiceForPdf(where: SQL | undefined) {
  return db.query.invoices.findFirst({
    where,
    with: {
      client: true,
      matter: true,
      rectifies: true,
      items: { orderBy: (i) => asc(i.id) },
      rectifications: { where: (r) => eq(r.status, "emitida"), orderBy: (r) => asc(r.id) },
      einvoices: { orderBy: (e) => desc(e.id) },
    },
  });
}

export type InvoiceForPdf = NonNullable<Awaited<ReturnType<typeof loadInvoiceForPdf>>>;

/** Respuesta HTTP con el PDF de la factura (siempre como descarga, sin caché). */
export async function invoicePdfResponse(inv: InvoiceForPdf): Promise<Response> {
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
    einvoice: (() => {
      const env = haciendaEnv();
      const e = inv.einvoices.find((x) => x.environment === env && x.status !== "rechazado" && x.status !== "no_recibido");
      return e
        ? { label: DOC_TYPES[e.docType as DocType], consecutive: e.consecutive, clave: e.clave, issuedAt: e.issuedAt, status: einvoiceStatusLabels[e.status] }
        : null;
    })(),
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
