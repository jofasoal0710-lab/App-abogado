export const config = {
  currency: process.env.CURRENCY ?? "EUR",
  defaultTaxRate: Number(process.env.DEFAULT_TAX_RATE ?? 21),
  firmName: process.env.FIRM_NAME ?? "Bufete",
  firmTaxId: process.env.FIRM_TAX_ID ?? "",
  firmAddress: process.env.FIRM_ADDRESS ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "./storage",
  maxUploadBytes: 25 * 1024 * 1024,
  locale: "es-ES",
} as const;
