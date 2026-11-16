export const config = {
  currency: process.env.CURRENCY ?? "EUR",
  defaultTaxRate: Number(process.env.DEFAULT_TAX_RATE ?? 21),
  /** Retención de IRPF por defecto (solo se propone a clientes de tipo «empresa»). 0 la desactiva. */
  defaultWithholdingRate: Number(process.env.DEFAULT_WITHHOLDING_RATE ?? 15),
  firmName: process.env.FIRM_NAME ?? "Bufete",
  firmTaxId: process.env.FIRM_TAX_ID ?? "",
  firmAddress: process.env.FIRM_ADDRESS ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "./storage",
  maxUploadBytes: 25 * 1024 * 1024,
  locale: "es-ES",
} as const;
