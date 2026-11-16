import { describe, expect, it } from "vitest";
import { csvDate, csvDecimal, csvText, toCsv, CSV_BOM } from "../src/lib/csv";
import { summarizeInvoice } from "../src/lib/invoices";
import { invoiceTotals, lineAmountCents, roundAway, type LineItem } from "../src/lib/money";
import { canRectify, exceedsOriginal, negateItems } from "../src/lib/rectification";

describe("redondeo", () => {
  it("mitad lejos de cero, simétrico", () => {
    expect(roundAway(212.5)).toBe(213);
    expect(roundAway(-212.5)).toBe(-213);
    expect(roundAway(0.4)).toBe(0);
    expect(roundAway(-0.4)).toBe(0);
    expect(Object.is(roundAway(-0.2), -0)).toBe(false); // sin -0
  });
});

describe("retención de IRPF", () => {
  it("se calcula sobre la base, no sobre el IVA: 1.000 € + 21 % − 15 % = 1.060 €", () => {
    const t = invoiceTotals([{ unit: "unidades", quantity: 100, unitPriceCents: 100000 }], 21, 15);
    expect(t).toEqual({ subtotalCents: 100000, taxCents: 21000, withholdingCents: 15000, totalCents: 106000 });
  });
  it("sin retención el total es el de siempre (base + IVA)", () => {
    expect(invoiceTotals([{ unit: "unidades", quantity: 100, unitPriceCents: 100000 }], 21).totalCents).toBe(121000);
  });
  it("redondea la retención al céntimo: 15 % de 212,50 = 31,875 → 31,88", () => {
    const t = invoiceTotals([{ unit: "horas", quantity: 85, unitPriceCents: 15000 }], 21, 15);
    expect(t.subtotalCents).toBe(21250);
    expect(t.withholdingCents).toBe(3188);
    expect(t.taxCents).toBe(4463);
    expect(t.totalCents).toBe(21250 + 4463 - 3188);
  });
  it("retención del 7 % y 19 %", () => {
    const items: LineItem[] = [{ unit: "unidades", quantity: 100, unitPriceCents: 50000 }];
    expect(invoiceTotals(items, 21, 7).withholdingCents).toBe(3500);
    expect(invoiceTotals(items, 21, 19).withholdingCents).toBe(9500);
  });
});

describe("un abono es exactamente el opuesto de la factura", () => {
  // Generador determinista (LCG) para no depender de Math.random
  let seed = 123456789;
  const rnd = (n: number) => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed % n);

  it("500 facturas aleatorias: cada importe del abono es el opuesto exacto", () => {
    for (let i = 0; i < 500; i++) {
      const items: LineItem[] = Array.from({ length: 1 + rnd(5) }, () =>
        rnd(2) ? { unit: "horas" as const, quantity: 1 + rnd(600), unitPriceCents: 1 + rnd(40000) } : { unit: "unidades" as const, quantity: 1 + rnd(1000), unitPriceCents: 1 + rnd(900000) },
      );
      const tax = [0, 4, 10, 21][rnd(4)], wh = [0, 7, 15, 19][rnd(4)];
      const a = invoiceTotals(items, tax, wh);
      const b = invoiceTotals(negateItems(items), tax, wh);
      // La suma de la factura y su abono es exactamente cero en CADA concepto.
      expect(a.subtotalCents + b.subtotalCents).toBe(0);
      expect(a.taxCents + b.taxCents).toBe(0);
      expect(a.withholdingCents + b.withholdingCents).toBe(0);
      expect(a.totalCents + b.totalCents).toBe(0);
    }
  });
  it("línea por línea también", () => {
    const it: LineItem = { unit: "horas", quantity: 85, unitPriceCents: 15000 };
    expect(lineAmountCents({ ...it, unitPriceCents: -15000 })).toBe(-lineAmountCents(it));
  });
});

describe("rectificativas", () => {
  it("solo se rectifica una factura emitida o pagada que no sea ya rectificativa", () => {
    expect(canRectify({ kind: "factura", status: "emitida" })).toBe(true);
    expect(canRectify({ kind: "factura", status: "pagada" })).toBe(true);
    expect(canRectify({ kind: "factura", status: "borrador" })).toBe(false);
    expect(canRectify({ kind: "factura", status: "anulada" })).toBe(false);
    expect(canRectify({ kind: "rectificativa", status: "emitida" })).toBe(false);
  });
  it("no se puede abonar más de lo facturado, contando las demás rectificativas", () => {
    expect(exceedsOriginal(100000, [], -100000)).toBe(false); // abono total
    expect(exceedsOriginal(100000, [], -100001)).toBe(true);
    expect(exceedsOriginal(100000, [-40000], -60000)).toBe(false);
    expect(exceedsOriginal(100000, [-40000], -60001)).toBe(true);
    expect(exceedsOriginal(100000, [], 5000)).toBe(false); // una rectificativa puede AUMENTAR el importe
  });
});

describe("saldo de una factura con rectificativas", () => {
  const base = { kind: "factura" as const, taxRate: 21, withholdingRate: 15, dueDate: "2026-11-01", items: [{ unit: "unidades" as const, quantity: 100, unitPriceCents: 100000 }] };
  const today = "2026-11-14";

  it("sin rectificativas: total 1.060, pendiente 1.060 y vencida", () => {
    const s = summarizeInvoice({ ...base, status: "emitida", payments: [] }, today);
    expect(s.totalCents).toBe(106000);
    expect(s.outstandingCents).toBe(106000);
    expect(s.overdue).toBe(true);
  });
  it("un abono total deja el pendiente en 0 y la factura deja de estar vencida", () => {
    const s = summarizeInvoice({ ...base, status: "emitida", payments: [] }, today, { cents: -106000, count: 1 });
    expect(s.netTotalCents).toBe(0);
    expect(s.outstandingCents).toBe(0);
    expect(s.overdue).toBe(false);
    expect(s.rectified).toBe(true);
  });
  it("un abono parcial reduce lo pendiente", () => {
    const s = summarizeInvoice({ ...base, status: "emitida", payments: [{ amountCents: 20000 }] }, today, { cents: -26000, count: 1 });
    expect(s.netTotalCents).toBe(80000);
    expect(s.outstandingCents).toBe(60000);
  });
  it("si ya estaba cobrada y se abona, aparece un saldo a favor del cliente", () => {
    const s = summarizeInvoice({ ...base, status: "pagada", payments: [{ amountCents: 106000 }] }, today, { cents: -50000, count: 1 });
    expect(s.outstandingCents).toBe(0);
    expect(s.creditCents).toBe(50000);
  });
  it("una rectificativa no tiene saldo propio ni vence", () => {
    const s = summarizeInvoice({ ...base, kind: "rectificativa", status: "emitida", items: [{ unit: "unidades", quantity: 100, unitPriceCents: -100000 }], payments: [] }, today);
    expect(s.totalCents).toBe(-106000);
    expect(s.outstandingCents).toBe(0);
    expect(s.overdue).toBe(false);
  });
  it("un borrador no genera pendiente de cobro", () => {
    expect(summarizeInvoice({ ...base, status: "borrador", payments: [] }, today).outstandingCents).toBe(0);
  });
});

describe("CSV", () => {
  it("neutraliza fórmulas en textos", () => {
    expect(csvText('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(csvText("+34 600 000 000")).toBe("'+34 600 000 000");
    expect(csvText("-1+1")).toBe("'-1+1");
    expect(csvText("@SUMA(A1)")).toBe("'@SUMA(A1)");
    expect(csvText("\t=cmd")).toBe("'=cmd"); // el tabulador inicial se recorta y queda neutralizada la fórmula
  });
  it("un texto normal no se toca", () => {
    expect(csvText("Construcciones Ribera S.L.")).toBe("Construcciones Ribera S.L.");
  });
  it("entrecomilla lo que lleva ;, comillas o saltos de línea", () => {
    expect(csvText("Pérez; Gómez")).toBe('"Pérez; Gómez"');
    expect(csvText('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(csvText("línea1\nlínea2")).toBe("línea1 línea2");
  });
  it("importes con coma decimal y sin separador de miles; los negativos NO se neutralizan", () => {
    expect(csvDecimal(123456)).toBe("1234,56");
    expect(csvDecimal(5)).toBe("0,05");
    expect(csvDecimal(-1250)).toBe("-12,50");
    expect(csvDecimal(0)).toBe("0,00");
  });
  it("fechas dd/mm/aaaa", () => {
    expect(csvDate("2026-11-14")).toBe("14/11/2026");
    expect(csvDate(null)).toBe("");
  });
  it("lleva BOM UTF-8, separador ; y CRLF", () => {
    const out = toCsv(["A", "B"], [["1", csvText("x;y")]]);
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(CSV_BOM + 'A;B\r\n1;"x;y"\r\n');
  });
});
