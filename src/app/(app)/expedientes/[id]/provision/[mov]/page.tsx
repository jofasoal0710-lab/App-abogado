import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { clients, matterFunds } from "@/db/schema";
import { getAccessibleMatter } from "@/lib/access";
import { requirePermission } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import { paymentMethodLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "../../../../reportes/print-button";

/** Recibo de un depósito del cliente (o constancia de una devolución), para imprimir o guardar en PDF. */
export default async function FundReceiptPage({ params }: { params: Promise<{ id: string; mov: string }> }) {
  const { id, mov } = await params;
  const user = await requirePermission("facturacion.ver");
  const matter = await getAccessibleMatter(user, Number(id));
  if (!matter) notFound();
  const [m] = await db.select().from(matterFunds).where(and(eq(matterFunds.id, Number(mov)), eq(matterFunds.matterId, matter.id)));
  if (!m || (m.kind !== "deposito" && m.kind !== "devolucion")) notFound();
  const [client] = await db.select({ name: clients.name, taxId: clients.taxId }).from(clients).where(eq(clients.id, matter.clientId));
  const deposit = m.kind === "deposito";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href={`/expedientes/${matter.id}?tab=cobro#provision`} className="btn-ghost btn-sm">
          ← Volver al expediente
        </Link>
        <PrintButton />
      </div>
      <article className="card card-pad space-y-5">
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
          <div>
            <p className="font-serif text-lg font-semibold">{config.firmName}</p>
            {config.firmTaxId && <p className="text-xs text-ink-500">Cédula jurídica {config.firmTaxId}</p>}
            {config.firmAddress && <p className="text-xs text-ink-500">{config.firmAddress}</p>}
          </div>
          <div className="text-right">
            <h1 className="font-serif text-xl font-semibold">{deposit ? "Recibo de provisión de fondos" : "Constancia de devolución"}</h1>
            <p className="text-sm text-ink-600">N.º {String(m.id).padStart(6, "0")} · {formatDate(m.movedOn)}</p>
          </div>
        </header>
        <p className="text-sm leading-relaxed">
          {deposit ? (
            <>Se recibe de <strong>{client?.name}</strong>{client?.taxId ? `, cédula ${client.taxId},` : ""} la suma de </>
          ) : (
            <>Se devuelve a <strong>{client?.name}</strong>{client?.taxId ? `, cédula ${client.taxId},` : ""} la suma de </>
          )}
          <strong className="tabular-nums">{formatMoney(m.amountCents)}</strong> {deposit ? "como provisión de fondos para gastos y honorarios del asunto" : "correspondiente al saldo no utilizado de la provisión de fondos del asunto"}{" "}
          <strong>{matter.number} — {matter.title}</strong>.
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="label">Concepto</dt>
            <dd>{m.description}</dd>
          </div>
          <div>
            <dt className="label">Forma</dt>
            <dd>{m.method ? paymentMethodLabels[m.method] : "—"}</dd>
          </div>
          <div>
            <dt className="label">Referencia</dt>
            <dd>{m.reference ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-500">
          {deposit
            ? "Este recibo no es una factura: la provisión se aplicará a gastos y a las facturas que se emitan, y el saldo no utilizado se devolverá al cliente."
            : "Con esta devolución se liquida, por el importe indicado, la provisión de fondos del asunto."}
        </p>
        <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs text-ink-500">
          <p className="border-t border-ink-300 pt-1">Firma {deposit ? "de quien recibe" : "del despacho"}</p>
          <p className="border-t border-ink-300 pt-1">Firma {deposit ? "del cliente" : "de quien recibe"}</p>
        </div>
      </article>
    </div>
  );
}
