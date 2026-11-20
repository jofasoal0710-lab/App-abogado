/**
 * Comprobantes electrónicos de Hacienda (Costa Rica, versión 4.4): de una factura de la aplicación al
 * documento que exige Hacienda. Este módulo no firma ni envía nada (eso está en ./hacienda.ts): solo
 * decide el tipo de comprobante, traduce las líneas y genera el XML sin firmar.
 */
import {
  buildClave,
  buildFacturaXml,
  buildNotaCreditoXml,
  buildNotaDebitoXml,
  buildTiqueteXml,
  calculateInvoiceSummary,
  calculateLineItemTotals,
  Situation,
} from "@dojocoding/hacienda-sdk";
import { lineAmountCents, type LineItem } from "../money";

export const DOC_TYPES = {
  "01": "Factura electrónica",
  "02": "Nota de débito electrónica",
  "03": "Nota de crédito electrónica",
  "04": "Tiquete electrónico",
} as const;
export type DocType = keyof typeof DOC_TYPES;

export const EMITTER_ID_TYPES = { "01": "Cédula física", "02": "Cédula jurídica", "03": "DIMEX", "04": "NITE" } as const;
export type EmitterIdType = keyof typeof EMITTER_ID_TYPES;

export const PAYMENT_METHODS = {
  "04": "Transferencia / depósito",
  "06": "SINPE Móvil",
  "01": "Efectivo",
  "02": "Tarjeta",
  "03": "Cheque",
  "07": "Plataforma digital",
} as const;

/** Tipo de identificación del cliente (lib/cr-id.ts) → código de Hacienda. Pasaporte y vacío no tienen. */
const CLIENT_ID_CODES: Record<string, EmitterIdType> = { cedula_fisica: "01", cedula_juridica: "02", dimex: "03", nite: "04" };

/** Tarifa de IVA (porcentaje) → código de tarifa de Hacienda. */
const IVA_RATE_CODES: Record<number, string> = { 13: "08", 4: "04", 2: "03", 1: "02" };

export type EmitterSettings = {
  name: string;
  idType: string;
  idNumber: string;
  commercialName: string | null;
  email: string;
  phone: string | null;
  province: string;
  canton: string;
  district: string;
  otherSigns: string;
  activityCode: string;
  branch: string;
  terminal: string;
  defaultCabys: string;
  paymentMethod: string;
  providerId: string | null;
};

export type InvoiceForEinvoice = {
  kind: "factura" | "rectificativa";
  issueDate: string;
  dueDate: string | null;
  taxRate: number;
  withholdingRate: number;
  items: (LineItem & { description: string; cabys: string | null })[];
  client: { name: string; idType: string | null; taxId: string | null; email: string | null };
};

export class EinvoiceError extends Error {}

/** Revisa los datos del emisor; devuelve el primer problema o null. */
export function emitterProblem(s: Partial<EmitterSettings>): string | null {
  if (!s.name?.trim()) return "Falta el nombre del emisor.";
  if (!s.idType || !(s.idType in EMITTER_ID_TYPES)) return "El tipo de identificación del emisor no es válido.";
  const len = { "01": [9, 9], "02": [10, 10], "03": [11, 12], "04": [10, 10] }[s.idType as EmitterIdType];
  if (!s.idNumber || !/^\d+$/.test(s.idNumber) || s.idNumber.length < len[0] || s.idNumber.length > len[1])
    return "La identificación del emisor no es válida (solo dígitos, sin guiones).";
  if (!s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return "El correo del emisor no es válido.";
  if (s.phone && !/^\d{8}$/.test(s.phone)) return "El teléfono del emisor debe tener 8 dígitos.";
  if (!s.province || !/^[1-7]$/.test(s.province)) return "La provincia es un código de 1 a 7.";
  if (!s.canton || !/^\d{2}$/.test(s.canton)) return "El cantón es un código de 2 dígitos (p. ej. 01).";
  if (!s.district || !/^\d{2}$/.test(s.district)) return "El distrito es un código de 2 dígitos (p. ej. 01).";
  if (!s.otherSigns || s.otherSigns.trim().length < 5) return "Indica las otras señas de la dirección (mínimo 5 caracteres).";
  if (!s.activityCode || !/^[0-9.]{6}$/.test(s.activityCode)) return "El código de actividad económica tiene 6 caracteres (p. ej. 691001).";
  if (!s.branch || !/^\d{3}$/.test(s.branch)) return "La sucursal tiene 3 dígitos (001).";
  if (!s.terminal || !/^\d{5}$/.test(s.terminal)) return "La terminal tiene 5 dígitos (00001).";
  if (!s.defaultCabys || !/^\d{13}$/.test(s.defaultCabys)) return "El código CABYS tiene 13 dígitos.";
  if (!s.paymentMethod || !(s.paymentMethod in PAYMENT_METHODS)) return "El medio de pago no es válido.";
  if (s.providerId && !/^\d{9,12}$/.test(s.providerId)) return "La cédula del proveedor de sistemas no es válida.";
  return null;
}

/** Qué comprobante corresponde a esta factura. */
export function docTypeFor(inv: Pick<InvoiceForEinvoice, "kind" | "items" | "client">): DocType {
  if (inv.kind === "rectificativa") {
    const amounts = inv.items.map(lineAmountCents);
    if (amounts.length > 0 && amounts.every((a) => a < 0)) return "03";
    if (amounts.length > 0 && amounts.every((a) => a > 0)) return "02";
    throw new EinvoiceError(
      "Una rectificativa con importes positivos y negativos no se puede enviar: hazla solo con abonos (nota de crédito) o solo con cargos (nota de débito).",
    );
  }
  return receiverId(inv.client) ? "01" : "04";
}

function receiverId(c: InvoiceForEinvoice["client"]) {
  const tipo = c.idType ? CLIENT_ID_CODES[c.idType] : undefined;
  const numero = (c.taxId ?? "").replace(/\D/g, "");
  return tipo && numero ? { tipo, numero } : null;
}

/** «AAAA-MM-DDTHH:MM:SS-06:00» en hora de Costa Rica (sin horario de verano). */
export function crDateTime(d: Date): string {
  const local = new Date(d.getTime() - 6 * 3600_000);
  return local.toISOString().slice(0, 19) + "-06:00";
}

export function consecutiveFor(branch: string, terminal: string, docType: DocType, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999_999_999) throw new EinvoiceError("Consecutivo fuera de rango.");
  return `${branch}${terminal}${docType}${String(sequence).padStart(10, "0")}`;
}

function money(cents: number) {
  return Math.round(cents) / 100;
}

/**
 * Una línea de la factura → línea de Hacienda. Las horas se envían en horas («h») cuando la cantidad es
 * exacta con 3 decimales; si no (p. ej. 1 h 20 min), como un servicio por el importe de la línea, para que
 * el comprobante cuadre al céntimo con la factura.
 */
function toLine(it: InvoiceForEinvoice["items"][number], n: number, ivaCode: string, rate: number, defaultCabys: string, sign: 1 | -1) {
  const cabys = it.cabys ?? defaultCabys;
  const amount = sign * lineAmountCents(it);
  const price = sign * it.unitPriceCents;
  let cantidad: number;
  let unidadMedida: string;
  let precioUnitario: number;
  let detalle = it.description.trim().replace(/\s+/g, " ");
  if (it.unit === "horas" && (it.quantity * 1000) % 60 === 0) {
    cantidad = it.quantity / 60;
    unidadMedida = "h";
    precioUnitario = money(price);
  } else if (it.unit === "horas") {
    const h = Math.floor(it.quantity / 60);
    const m = it.quantity % 60;
    detalle += ` (${h} h ${m} min)`;
    cantidad = 1;
    unidadMedida = "Sp";
    precioUnitario = money(amount);
  } else {
    cantidad = it.quantity / 100;
    unidadMedida = "Sp";
    precioUnitario = money(price);
  }
  return calculateLineItemTotals({
    numeroLinea: n,
    codigoCabys: cabys,
    cantidad,
    unidadMedida,
    detalle: detalle.slice(0, 200),
    precioUnitario,
    esServicio: true,
    impuesto: [{ codigo: "01", codigoTarifaIVA: ivaCode, tarifa: rate }],
  } as Parameters<typeof calculateLineItemTotals>[0]);
}

/** total: anula el comprobante de referencia (abono total). Si no, corrige el monto. */
export type Reference = { docType: DocType; clave: string; issuedAt: string; reason: string; total: boolean };

export type BuildInput = {
  invoice: InvoiceForEinvoice;
  emitter: EmitterSettings;
  docType: DocType;
  sequence: number;
  now: Date;
  /** Notas de crédito y débito: el comprobante que corrigen. */
  reference?: Reference;
};

export type BuiltDocument = {
  docType: DocType;
  clave: string;
  consecutive: string;
  issuedAt: string;
  xml: string;
  totalCents: number;
  receiver: { tipo: string; numero: string } | null;
};

export function buildDocument({ invoice, emitter, docType, sequence, now, reference }: BuildInput): BuiltDocument {
  const problem = emitterProblem(emitter);
  if (problem) throw new EinvoiceError(problem);
  if (invoice.withholdingRate > 0)
    throw new EinvoiceError("Esta factura tiene una retención aplicada: en Costa Rica no va en el comprobante. Quita la retención antes de enviarla.");
  const ivaCode = IVA_RATE_CODES[invoice.taxRate];
  if (!ivaCode) throw new EinvoiceError(`La tarifa de IVA del ${invoice.taxRate} % no está admitida (usa 13, 4, 2 o 1 %).`);
  if (invoice.items.length === 0) throw new EinvoiceError("La factura no tiene líneas.");
  for (const it of invoice.items) {
    const c = it.cabys ?? emitter.defaultCabys;
    if (!/^\d{13}$/.test(c)) throw new EinvoiceError(`La línea «${it.description}» no tiene un código CABYS válido.`);
  }
  const isNote = docType === "02" || docType === "03";
  if (isNote && !reference) throw new EinvoiceError("Una nota de crédito o débito necesita el comprobante que corrige.");

  const sign: 1 | -1 = docType === "03" ? -1 : 1;
  const lines = invoice.items.map((it, i) => toLine(it, i + 1, ivaCode, invoice.taxRate, emitter.defaultCabys, sign));
  const summary = calculateInvoiceSummary(lines);

  const receiver = receiverId(invoice.client);
  if ((docType === "01" || isNote) && !receiver)
    throw new EinvoiceError("El cliente no tiene una identificación costarricense válida (cédula, DIMEX o NITE): no se le puede emitir factura electrónica.");

  const consecutive = consecutiveFor(emitter.branch, emitter.terminal, docType, sequence);
  const clave = buildClave({
    date: now,
    taxpayerId: emitter.idNumber,
    branch: emitter.branch,
    pos: emitter.terminal,
    documentType: docType,
    sequence,
    situation: Situation.NORMAL,
  } as Parameters<typeof buildClave>[0]);
  const issuedAt = crDateTime(now);

  const credit = !isNote && invoice.dueDate && invoice.dueDate > invoice.issueDate;
  const plazo = credit ? Math.round((Date.parse(invoice.dueDate!) - Date.parse(invoice.issueDate)) / 86400_000) : 0;
  const email = invoice.client.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.client.email) ? invoice.client.email : undefined;

  const doc = {
    clave,
    proveedorSistemas: emitter.providerId || emitter.idNumber,
    codigoActividadEmisor: emitter.activityCode.replace(".", ""),
    numeroConsecutivo: consecutive,
    fechaEmision: issuedAt,
    emisor: {
      nombre: emitter.name.slice(0, 100),
      identificacion: { tipo: emitter.idType, numero: emitter.idNumber },
      ...(emitter.commercialName ? { nombreComercial: emitter.commercialName.slice(0, 80) } : {}),
      ubicacion: { provincia: emitter.province, canton: emitter.canton, distrito: emitter.district, otrasSenas: emitter.otherSigns.slice(0, 250) },
      ...(emitter.phone ? { telefono: { codigoPais: "506", numTelefono: emitter.phone } } : {}),
      correoElectronico: emitter.email,
    },
    ...(receiver
      ? { receptor: { nombre: invoice.client.name.slice(0, 100), identificacion: receiver, ...(email ? { correoElectronico: email } : {}) } }
      : {}),
    condicionVenta: credit ? "02" : "01",
    ...(credit ? { plazoCredito: String(plazo) } : {}),
    detalleServicio: lines,
    resumenFactura: {
      codigoTipoMoneda: { codigoMoneda: "CRC", tipoCambio: 1 },
      ...summary,
      ...(credit ? {} : { medioPago: [{ tipoMedioPago: emitter.paymentMethod, totalMedioPago: summary.totalComprobante }] }),
    },
    ...(reference
      ? {
          informacionReferencia: [
            {
              tipoDoc: reference.docType,
              numero: reference.clave,
              fechaEmision: reference.issuedAt,
              ...(docType === "03" && reference.total ? { codigo: "01" } : { codigo: "99", codigoOtros: "Corrige monto" }),
              razon: reference.reason.slice(0, 180),
            },
          ],
        }
      : {}),
  };

  type Doc = Parameters<typeof buildFacturaXml>[0];
  const xml =
    docType === "01"
      ? buildFacturaXml(doc as unknown as Doc)
      : docType === "04"
        ? buildTiqueteXml(doc as unknown as Parameters<typeof buildTiqueteXml>[0])
        : docType === "03"
          ? buildNotaCreditoXml(doc as unknown as Parameters<typeof buildNotaCreditoXml>[0])
          : buildNotaDebitoXml(doc as unknown as Parameters<typeof buildNotaDebitoXml>[0]);

  return { docType, clave, consecutive, issuedAt, xml, totalCents: Math.round(summary.totalComprobante * 100), receiver };
}
