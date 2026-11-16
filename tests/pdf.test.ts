import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildInvoicePdf, type InvoicePdfInput } from "../src/lib/invoice-pdf";
import { fitFontSize, safeText, wrapText } from "../src/lib/pdf-text";

describe("safeText", () => {
  it("conserva el castellano y el euro", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(safeText(font, "Peña & Núñez S.L. — 1.234,56 €")).toBe("Peña & Núñez S.L. — 1.234,56 €");
  });
  it("sustituye lo que WinAnsi no puede codificar en vez de fallar", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(safeText(font, "Žižek")).toBe("Žižek"); // Ž sí está en WinAnsi: se conserva
    expect(safeText(font, "Dvořák Łukasz ś")).toBe("Dvorák ?ukasz s"); // ř→r y ś→s por su letra base (la á se conserva); Ł no tiene base
    expect(safeText(font, "Hola 😀 mundo")).toBe("Hola ? mundo");
    expect(safeText(font, "a b\tc")).toBe("a b c"); // espacios especiales normalizados
    expect(safeText(font, "x\u0007y")).toBe("xy"); // controles fuera
  });
});

describe("fitFontSize", () => {
  const font = { widthOfTextAtSize: (s: string, size: number) => s.length * size * 0.5 };
  it("si cabe, mantiene el tamaño", () => {
    expect(fitFontSize(font, "TOTAL", 100, 9.5)).toBe(9.5);
  });
  it("si no cabe, lo reduce hasta que quepa (el rótulo no se solapa con el importe)", () => {
    const size = fitFontSize(font, "TOTAL RECTIFICACIÓN", 80, 9.5);
    expect(size).toBeLessThan(9.5);
    expect(font.widthOfTextAtSize("TOTAL RECTIFICACIÓN", size)).toBeLessThanOrEqual(80);
  });
  it("no baja del mínimo", () => {
    expect(fitFontSize(font, "x".repeat(500), 10, 9.5, 6)).toBe(6);
  });
});

describe("wrapText", () => {
  const font = { widthOfTextAtSize: (s: string, size: number) => s.length * size * 0.5 };
  it("parte por palabras y respeta saltos de línea", () => {
    expect(wrapText("uno dos tres cuatro", font, 10, 50)).toEqual(["uno dos", "tres", "cuatro"]);
    expect(wrapText("a\nb", font, 10, 100)).toEqual(["a", "b"]);
  });
  it("parte una palabra más larga que la línea", () => {
    const lines = wrapText("abcdefghijklmnop", font, 10, 30);
    expect(lines.every((l) => font.widthOfTextAtSize(l, 10) <= 30)).toBe(true);
    expect(lines.join("")).toBe("abcdefghijklmnop");
  });
  it("texto vacío → una línea vacía", () => {
    expect(wrapText("", font, 10, 50)).toEqual([""]);
  });
});

const input = (over: Partial<InvoicePdfInput> = {}): InvoicePdfInput => ({
  firm: { name: "Bufete Ejemplo & Asociados", taxId: "B00000000", address: "Calle Mayor 1, 28001 Madrid" },
  invoice: { number: "FAC-2026-0001", status: "emitida", kind: "factura", issueDate: "2026-11-14", dueDate: "2026-12-14", taxRate: 21, withholdingRate: 15, notes: null, rectificationReason: null },
  client: { name: "Construcciones Ribera S.L.", taxId: "B12345678", address: "Pol. Ind. Norte, nave 4" },
  matter: { number: "EXP-2026-0001", title: "Reclamación de cantidad" },
  items: [{ description: "Redacción de la demanda", unit: "horas", quantity: 210, unitPriceCents: 18000 }],
  rectifies: null,
  rectifiedBy: [],
  ...over,
});

describe("buildInvoicePdf", () => {
  it("genera un PDF válido de una página", async () => {
    const bytes = await buildInvoicePdf(input());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("no falla con caracteres que WinAnsi no soporta", async () => {
    const bytes = await buildInvoicePdf(input({ client: { name: "Łukasz Žižek 😀 GmbH", taxId: null, address: null } }));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("pagina cuando hay muchas líneas", async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ description: `Concepto número ${i + 1} con un texto suficientemente largo para ocupar varias líneas en la columna de conceptos de la tabla`, unit: "unidades" as const, quantity: 100, unitPriceCents: 1000 + i }));
    const doc = await PDFDocument.load(await buildInvoicePdf(input({ items })));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
  it("admite rectificativas con importes negativos y borradores sin número", async () => {
    const rect = await buildInvoicePdf(input({
      invoice: { number: "RECT-2026-0001", status: "emitida", kind: "rectificativa", issueDate: "2026-11-15", dueDate: null, taxRate: 21, withholdingRate: 15, notes: null, rectificationReason: "Error en el importe" },
      items: [{ description: "Redacción de la demanda", unit: "horas", quantity: 210, unitPriceCents: -18000 }],
      rectifies: { number: "FAC-2026-0001", issueDate: "2026-11-14" },
    }));
    expect((await PDFDocument.load(rect)).getPageCount()).toBe(1);
    const draft = await buildInvoicePdf(input({ invoice: { ...input().invoice, number: null, status: "borrador" } }));
    expect((await PDFDocument.load(draft)).getPageCount()).toBe(1);
  });
  it("una factura sin líneas tampoco rompe", async () => {
    expect((await PDFDocument.load(await buildInvoicePdf(input({ items: [] })))).getPageCount()).toBe(1);
  });
});
