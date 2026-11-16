/**
 * Todo el dinero se maneja como enteros en céntimos para evitar errores de coma flotante.
 */

export type LineItem = {
  unit: "horas" | "unidades";
  /** Minutos si unit = "horas"; centésimas si unit = "unidades". */
  quantity: number;
  /** Precio por hora o por unidad, en céntimos. */
  unitPriceCents: number;
};

export function formatMoney(cents: number, currency = "EUR", locale = "es-ES"): string {
  // useGrouping "always": en es-ES los números de 4 cifras no llevan separador de miles por
  // defecto ("1500,00 €"); en documentos contables preferimos importes homogéneos ("1.500,00 €").
  return new Intl.NumberFormat(locale, { style: "currency", currency, useGrouping: "always" }).format(cents / 100);
}

/**
 * Convierte texto introducido por una persona ("1.234,56", "1234.56", "150") en céntimos.
 * Devuelve null si no es un importe válido.
 */
export function parseMoneyToCents(input: string): number | null {
  let s = input.trim().replace(/[\s€$]/g, "");
  if (!s) return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let decPart = "";

  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos presentes: el último separador es el decimal.
    const decIdx = Math.max(lastComma, lastDot);
    intPart = s.slice(0, decIdx).replace(/[.,]/g, "");
    decPart = s.slice(decIdx + 1);
  } else if (lastComma !== -1) {
    // Solo comas: la coma es el decimal salvo que haya varias (miles).
    if (s.indexOf(",") !== lastComma) {
      if (!/^\d{1,3}(,\d{3})+$/.test(s)) return null;
      intPart = s.replace(/,/g, "");
    } else {
      intPart = s.slice(0, lastComma);
      decPart = s.slice(lastComma + 1);
    }
  } else if (lastDot !== -1) {
    // Solo puntos: "1.500" o "12.345.678" son miles; "150.5" y "0.75" son decimales.
    const multiple = s.indexOf(".") !== lastDot;
    const looksLikeThousands = /^\d{1,3}(\.\d{3})+$/.test(s);
    if (multiple && !looksLikeThousands) return null;
    if (looksLikeThousands) {
      intPart = s.replace(/\./g, "");
    } else {
      intPart = s.slice(0, lastDot);
      decPart = s.slice(lastDot + 1);
    }
  } else {
    intPart = s;
  }

  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart) || (decPart !== "" && !/^\d+$/.test(decPart))) return null;
  if (decPart.length > 2) return null;
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/**
 * Redondeo «mitad lejos de cero»: 212,5 → 213 y −212,5 → −213. Con Math.round, −212,5 daría −212 y un
 * abono no sería EXACTAMENTE el negativo de la factura que corrige.
 */
export function roundAway(x: number): number {
  const r = x < 0 ? -Math.round(-x) : Math.round(x);
  return r === 0 ? 0 : r; // evita -0
}

/** Importe de una línea, redondeado al céntimo (negativo en las líneas de una rectificativa). */
export function lineAmountCents(item: LineItem): number {
  const divisor = item.unit === "horas" ? 60 : 100;
  return roundAway((item.quantity * item.unitPriceCents) / divisor);
}

/**
 * Totales de una factura: base, IVA, retención de IRPF (sobre la base, no sobre el IVA) y total a pagar
 * (= base + IVA − retención). Cada concepto se redondea una sola vez, al céntimo.
 */
export function invoiceTotals(items: LineItem[], taxRatePercent: number, withholdingRatePercent = 0) {
  const subtotalCents = items.reduce((sum, it) => sum + lineAmountCents(it), 0);
  const taxCents = roundAway((subtotalCents * taxRatePercent) / 100);
  const withholdingCents = roundAway((subtotalCents * withholdingRatePercent) / 100);
  return { subtotalCents, taxCents, withholdingCents, totalCents: subtotalCents + taxCents - withholdingCents };
}

/** Importe de un tiempo facturable: minutos × tarifa horaria. */
export function timeAmountCents(minutes: number, hourlyRateCents: number): number {
  return Math.round((minutes * hourlyRateCents) / 60);
}

/** "1 h 25 min", "45 min", "2 h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Interpreta "1:30", "1,5", "1.5", "90m", "2h", "1h 15m" como minutos. */
export function parseDurationToMinutes(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  let m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  m = s.match(/^(?:(\d+)h)?(?:(\d+)(?:m|min)?)?$/);
  if (m && (m[1] || m[2])) {
    // "90" a secas se interpreta como minutos; "2h" y "1h15" como horas/minutos.
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  }

  m = s.match(/^(\d+(?:[.,]\d+)?)h?$/);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 60);
  return null;
}

/** Cantidad en unidades (texto "1,5") a centésimas. */
export function parseQuantityToHundredths(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function formatQuantity(item: Pick<LineItem, "unit" | "quantity">): string {
  if (item.unit === "horas") return formatDuration(item.quantity);
  const v = item.quantity / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}
