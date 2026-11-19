export const config = {
  currency: process.env.CURRENCY || "CRC",
  /** IVA general de Costa Rica: 13 %. */
  defaultTaxRate: Number(process.env.DEFAULT_TAX_RATE ?? 13),
  /** Retención por defecto (solo se propone a clientes de tipo «empresa»). 0 = desactivada (por defecto en Costa Rica). */
  defaultWithholdingRate: Number(process.env.DEFAULT_WITHHOLDING_RATE ?? 0),
  firmName: process.env.FIRM_NAME ?? "Bufete",
  firmTaxId: process.env.FIRM_TAX_ID ?? "",
  firmAddress: process.env.FIRM_ADDRESS ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "./storage",
  maxUploadBytes: 25 * 1024 * 1024,
  locale: process.env.APP_LOCALE || "es-CR",
} as const;
