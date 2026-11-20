import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { einvoices, einvoiceSettings, invoices, type Einvoice, type EinvoiceSettings } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import type { AccessUser } from "@/lib/access-rules";
import { lineAmountCents, type LineItem } from "@/lib/money";
import { buildDocument, docTypeFor, EinvoiceError, type DocType, type Reference } from "./build";
import { haciendaEnv, HaciendaFailure, queryStatus, sendDocument, signDocument } from "./hacienda";

export async function getEinvoiceSettings(): Promise<EinvoiceSettings | null> {
  return (await db.query.einvoiceSettings.findFirst({ where: eq(einvoiceSettings.id, 1) })) ?? null;
}

/** Un comprobante bloquea un nuevo envío salvo que Hacienda no lo recibiera o lo rechazara. */
export function blocksResend(e: Pick<Einvoice, "status">) {
  return e.status !== "no_recibido" && e.status !== "rechazado";
}

type Outcome = { ok: string } | { error: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Firma y envía a Hacienda el comprobante de una factura emitida.
 *  1. En una transacción (con el emisor bloqueado para que dos envíos no tomen el mismo consecutivo):
 *     asigna el consecutivo, genera y firma el XML y lo guarda como «enviando».
 *  2. Lo envía. Según la respuesta queda recibido, no_recibido (se puede reintentar) o enviando (dudoso:
 *     hay que consultar antes de reintentar, para no duplicar).
 *  3. Consulta una vez el estado por si Hacienda ya lo procesó.
 */
export async function sendInvoiceToHacienda(user: AccessUser, invoiceId: number): Promise<Outcome> {
  const env = haciendaEnv();
  const inv = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), invoiceAccessSql(user)),
    with: { items: { orderBy: (i) => asc(i.id) }, client: true, einvoices: true, rectifies: { with: { einvoices: true, items: true } } },
  });
  if (!inv) return { error: "No tienes acceso a esta factura." };
  if (inv.status !== "emitida" && inv.status !== "pagada") return { error: "Solo se envían a Hacienda las facturas emitidas." };
  const previous = inv.einvoices.filter((e) => e.environment === env && blocksResend(e));
  if (previous.some((e) => e.status === "enviando"))
    return { error: "Hay un envío sin confirmar. Pulsa «Consultar estado» antes de volver a enviarla." };
  if (previous.length) return { error: "Esta factura ya se envió a Hacienda." };

  let docType: DocType;
  let reference: Reference | undefined;
  try {
    docType = docTypeFor(inv);
    if (docType === "02" || docType === "03") {
      const original = inv.rectifies?.einvoices.find((e) => e.environment === env && e.status === "aceptado");
      if (!original) return { error: "Primero envía a Hacienda la factura original: la nota tiene que referirse a un comprobante aceptado." };
      const total = docType === "03" && !!inv.rectifies && -sumLines(inv.items) === sumLines(inv.rectifies.items);
      reference = { docType: original.docType as DocType, clave: original.clave, issuedAt: original.issuedAt, reason: inv.rectificationReason ?? "Rectificación", total };
    }
  } catch (e) {
    if (e instanceof EinvoiceError) return { error: e.message };
    throw e;
  }

  let row: Einvoice;
  try {
    row = await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(einvoiceSettings).where(eq(einvoiceSettings.id, 1)).for("update");
      if (!settings) throw new EinvoiceError("Faltan los datos del emisor: complétalos en Facturas → Factura electrónica.");
      const [{ last }] = await tx
        .select({ last: sql<number>`coalesce(max(${einvoices.sequence}), 0)::int` })
        .from(einvoices)
        .where(and(eq(einvoices.environment, env), eq(einvoices.docType, docType), eq(einvoices.branch, settings.branch), eq(einvoices.terminal, settings.terminal)));
      const built = buildDocument({ invoice: inv, emitter: settings, docType, sequence: last + 1, now: new Date(), reference });
      const signedXml = await signDocument(built.xml);
      const [created] = await tx
        .insert(einvoices)
        .values({
          invoiceId,
          environment: env,
          docType,
          branch: settings.branch,
          terminal: settings.terminal,
          sequence: last + 1,
          consecutive: built.consecutive,
          clave: built.clave,
          issuedAt: built.issuedAt,
          totalCents: built.totalCents,
          signedXml,
          createdById: user.id,
        })
        .returning();
      return created;
    });
  } catch (e) {
    if (e instanceof EinvoiceError || e instanceof HaciendaFailure) return { error: e.message };
    throw e;
  }

  const settings = (await getEinvoiceSettings())!;
  try {
    await sendDocument({
      clave: row.clave,
      issuedAt: row.issuedAt,
      emitter: { tipo: settings.idType, numero: settings.idNumber },
      receiver: inv.client.taxId ? receiverFromXml(row.signedXml) : null,
      signedXml: row.signedXml,
    });
  } catch (e) {
    if (!(e instanceof HaciendaFailure)) throw e;
    await db
      .update(einvoices)
      .set({ status: e.notReceived ? "no_recibido" : "enviando", message: e.message, checkedAt: new Date() })
      .where(eq(einvoices.id, row.id));
    return { error: e.message };
  }
  await db.update(einvoices).set({ status: "recibido", message: null, checkedAt: new Date() }).where(eq(einvoices.id, row.id));

  // Hacienda suele procesar en segundos: una consulta rápida ahorra un clic.
  await wait(Number(process.env.HACIENDA_STATUS_WAIT_MS ?? 3000));
  const after = await refresh(row.id, row.clave, "recibido");
  return after === "aceptado"
    ? { ok: "Hacienda aceptó el comprobante." }
    : after === "rechazado"
      ? { error: "Hacienda rechazó el comprobante. Revisa el motivo abajo." }
      : { ok: "Enviado a Hacienda. Está en proceso: consulta el estado en unos minutos." };
}

function sumLines(items: LineItem[]) {
  return items.reduce((s, i) => s + lineAmountCents(i), 0);
}

/** El receptor exacto que va en el XML firmado (el envío debe coincidir con el comprobante). */
function receiverFromXml(xml: string) {
  const m = /<Receptor>[\s\S]*?<Identificacion>\s*<Tipo>(\d+)<\/Tipo>\s*<Numero>(\d+)<\/Numero>/.exec(xml);
  return m ? { tipo: m[1], numero: m[2] } : null;
}

async function refresh(id: number, clave: string, current: Einvoice["status"]): Promise<Einvoice["status"]> {
  let r;
  try {
    r = await queryStatus(clave);
  } catch (e) {
    if (e instanceof HaciendaFailure) return current;
    throw e;
  }
  // Un 404 justo después de enviar puede ser solo retraso: solo marcamos «no recibido» si estaba dudoso.
  if (r.state === "no_recibido" && current !== "enviando") return current;
  await db
    .update(einvoices)
    .set({ status: r.state, responseXml: "responseXml" in r ? (r.responseXml ?? null) : null, message: r.message ?? null, checkedAt: new Date() })
    .where(eq(einvoices.id, id));
  return r.state;
}

export async function checkEinvoiceStatus(user: AccessUser, einvoiceId: number): Promise<Outcome & { invoiceId?: number }> {
  const [row] = await db
    .select({ e: einvoices })
    .from(einvoices)
    .innerJoin(invoices, eq(invoices.id, einvoices.invoiceId))
    .where(and(eq(einvoices.id, einvoiceId), invoiceAccessSql(user)));
  if (!row) return { error: "No tienes acceso a este comprobante." };
  const e = row.e;
  if (e.status === "aceptado" || e.status === "no_recibido") return { ok: "El estado ya es definitivo.", invoiceId: e.invoiceId };
  try {
    const s = await refresh(e.id, e.clave, e.status);
    return { ok: `Estado en Hacienda: ${s.replace("_", " ")}.`, invoiceId: e.invoiceId };
  } catch (err) {
    if (err instanceof HaciendaFailure) return { error: err.message, invoiceId: e.invoiceId };
    throw err;
  }
}
