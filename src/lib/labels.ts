export const roleLabels = { admin: "Administrador", abogado: "Abogado/a", asistente: "Asistente" } as const;

export const clientTypeLabels = { persona: "Persona física", empresa: "Empresa" } as const;

export const areaLabels = {
  civil: "Civil",
  penal: "Penal",
  laboral: "Laboral",
  mercantil: "Mercantil",
  familia: "Familia",
  administrativo: "Administrativo",
  fiscal: "Fiscal",
  inmobiliario: "Inmobiliario",
  otros: "Otros",
} as const;

export const matterStatusLabels = {
  abierto: "Abierto",
  en_curso: "En curso",
  en_espera: "En espera",
  cerrado: "Cerrado",
  archivado: "Archivado",
} as const;

export const billingTypeLabels = { por_horas: "Por horas", tarifa_fija: "Por proceso (monto total)" } as const;
export const expenseKindLabels = { timbre: "Timbres", registro: "Derechos de registro", gasto: "Gasto", viaticos: "Viáticos y traslados" } as const;

export const eventKindLabels = {
  audiencia: "Audiencia",
  plazo: "Plazo",
  reunion: "Reunión",
  tarea: "Tarea",
} as const;

export const invoiceStatusLabels = {
  borrador: "Borrador",
  emitida: "Emitida",
  pagada: "Pagada",
  anulada: "Anulada",
} as const;

export const paymentMethodLabels = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  cheque: "Cheque",
  otro: "Otro",
} as const;

export function entries<T extends Record<string, string>>(obj: T) {
  return Object.entries(obj) as [keyof T & string, string][];
}
