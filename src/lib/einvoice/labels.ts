import type { Einvoice } from "@/db/schema";

export const einvoiceStatusLabels: Record<Einvoice["status"], string> = {
  enviando: "Sin confirmar",
  recibido: "Recibido",
  procesando: "En proceso",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  no_recibido: "No recibido",
};

export const einvoiceStatusBadge: Record<Einvoice["status"], string> = {
  enviando: "badge-amber",
  recibido: "badge-amber",
  procesando: "badge-amber",
  aceptado: "badge-green",
  rechazado: "badge-red",
  no_recibido: "badge-red",
};
