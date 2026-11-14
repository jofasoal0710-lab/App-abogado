/** Errores de negocio de facturación. Los códigos viajan por la URL; los textos, nunca. */
export const INVOICE_ERRORS = {
  forbidden: "No tienes permiso para realizar esta acción.",
  not_draft: "La factura ya no es un borrador y no se puede modificar.",
  matter_missing: "El expediente no existe.",
  matter_client_mismatch: "El expediente no pertenece al cliente seleccionado.",
  matter_required: "Para facturar horas u honorarios hay que seleccionar un expediente.",
  already_billed: "Alguna de las horas seleccionadas ya está facturada o no es facturable. Recarga la página.",
  no_items: "Añade al menos una línea antes de emitir la factura.",
  zero_total: "El total de la factura debe ser mayor que cero.",
  not_emitted_pay: "Solo se pueden registrar cobros en facturas emitidas.",
  overpay: "El importe supera lo pendiente de cobro de la factura.",
  not_emitted_void: "Solo se pueden anular facturas emitidas.",
  has_payments: "Elimina primero los cobros registrados para poder anular la factura.",
} as const;

export type InvoiceErrorCode = keyof typeof INVOICE_ERRORS;

export class BusinessError extends Error {
  constructor(public readonly code: InvoiceErrorCode) {
    super(INVOICE_ERRORS[code]);
  }
}

export function invoiceErrorMessage(code: string | undefined): string | null {
  return code && code in INVOICE_ERRORS ? INVOICE_ERRORS[code as InvoiceErrorCode] : null;
}
