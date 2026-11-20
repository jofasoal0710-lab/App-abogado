import { describe, expect, it } from "vitest";
import { validateDocumentXml } from "@dojocoding/hacienda-sdk";
import { buildDocument, consecutiveFor, crDateTime, docTypeFor, emitterProblem, EinvoiceError, type EmitterSettings, type InvoiceForEinvoice } from "../src/lib/einvoice/build";

const emitter: EmitterSettings = {
  name: "Bufete Ejemplo S.A.",
  idType: "02",
  idNumber: "3101123456",
  commercialName: "Bufete Ejemplo",
  email: "facturas@ejemplo.cr",
  phone: "22223333",
  province: "1",
  canton: "01",
  district: "08",
  otherSigns: "Barrio Escalante, 100 m norte de la iglesia",
  activityCode: "691001",
  branch: "001",
  terminal: "00001",
  defaultCabys: "8211000000100",
  paymentMethod: "04",
  providerId: null,
};

const invoice: InvoiceForEinvoice = {
  kind: "factura",
  issueDate: "2026-11-20",
  dueDate: null,
  taxRate: 13,
  withholdingRate: 0,
  items: [
    { description: "Asesoría legal", unit: "horas", quantity: 90, unitPriceCents: 4_000_000, cabys: null },
    { description: "Redacción de contrato", unit: "unidades", quantity: 100, unitPriceCents: 15_000_000, cabys: "8211000000100" },
  ],
  client: { name: "Ana Pérez Rojas", idType: "cedula_fisica", taxId: "112340567", email: "ana@example.com" },
};
const now = new Date("2026-11-20T16:30:00Z");

describe("factura electrónica: datos del emisor", () => {
  it("acepta un emisor completo y señala lo que falta", () => {
    expect(emitterProblem(emitter)).toBeNull();
    expect(emitterProblem({ ...emitter, idNumber: "3-101-123456" })).toMatch(/identificación/);
    expect(emitterProblem({ ...emitter, canton: "1" })).toMatch(/cantón/);
    expect(emitterProblem({ ...emitter, defaultCabys: "123" })).toMatch(/CABYS/);
    expect(emitterProblem({ ...emitter, activityCode: "69" })).toMatch(/actividad/);
  });
});

describe("factura electrónica: tipo de comprobante", () => {
  it("factura si el cliente tiene cédula; tiquete si no", () => {
    expect(docTypeFor(invoice)).toBe("01");
    expect(docTypeFor({ ...invoice, client: { ...invoice.client, idType: "pasaporte" } })).toBe("04");
    expect(docTypeFor({ ...invoice, client: { ...invoice.client, taxId: null } })).toBe("04");
  });
  it("rectificativa: nota de crédito (abonos) o de débito (cargos), nunca mezcladas", () => {
    const neg = invoice.items.map((i) => ({ ...i, unitPriceCents: -i.unitPriceCents }));
    expect(docTypeFor({ ...invoice, kind: "rectificativa", items: neg })).toBe("03");
    expect(docTypeFor({ ...invoice, kind: "rectificativa" })).toBe("02");
    expect(() => docTypeFor({ ...invoice, kind: "rectificativa", items: [neg[0], invoice.items[1]] })).toThrow(EinvoiceError);
  });
});

describe("factura electrónica: XML v4.4", () => {
  it("consecutivo, clave y fecha en hora de Costa Rica", () => {
    expect(consecutiveFor("001", "00001", "01", 7)).toBe("00100001010000000007");
    expect(crDateTime(now)).toBe("2026-11-20T10:30:00-06:00");
    const d = buildDocument({ invoice, emitter, docType: "01", sequence: 7, now });
    expect(d.clave).toHaveLength(50);
    expect(d.clave.startsWith("506201126")).toBe(true);
    expect(d.clave).toContain("003101123456");
    expect(d.clave).toContain(d.consecutive);
  });

  it("factura válida contra el esquema oficial, con totales al céntimo", async () => {
    const d = buildDocument({ invoice, emitter, docType: "01", sequence: 1, now });
    // 1,5 h × 40 000 + 150 000 = 210 000; IVA 13 % = 27 300
    expect(d.totalCents).toBe(23_730_000);
    expect(d.xml).toContain("<UnidadMedida>h</UnidadMedida>");
    expect(d.xml).toContain("<CodigoTarifaIVA>08</CodigoTarifaIVA>");
    const v = await validateDocumentXml(d.xml);
    expect(v.issues ?? []).toEqual([]);
    expect(v.valid).toBe(true);
  });

  it("horas no exactas (1 h 20 min) van como servicio por el importe de la línea", async () => {
    const inv = { ...invoice, items: [{ description: "Audiencia", unit: "horas" as const, quantity: 80, unitPriceCents: 3_000_000, cabys: null }] };
    const d = buildDocument({ invoice: inv, emitter, docType: "01", sequence: 2, now });
    expect(d.xml).toContain("Audiencia (1 h 20 min)");
    expect(d.totalCents).toBe(4_520_000); // 40 000 + 13 %
    expect((await validateDocumentXml(d.xml)).valid).toBe(true);
  });

  it("factura a crédito: condición 02 con plazo y sin medio de pago", async () => {
    const d = buildDocument({ invoice: { ...invoice, dueDate: "2026-12-20" }, emitter, docType: "01", sequence: 3, now });
    expect(d.xml).toContain("<CondicionVenta>02</CondicionVenta>");
    expect(d.xml).toContain("<PlazoCredito>30</PlazoCredito>");
    expect((await validateDocumentXml(d.xml)).valid).toBe(true);
  });

  it("tiquete sin receptor y nota de crédito que anula la factura, ambos válidos", async () => {
    const t = buildDocument({ invoice: { ...invoice, client: { name: "X", idType: null, taxId: null, email: null } }, emitter, docType: "04", sequence: 1, now });
    expect(t.receiver).toBeNull();
    expect((await validateDocumentXml(t.xml)).valid).toBe(true);

    const f = buildDocument({ invoice, emitter, docType: "01", sequence: 4, now });
    const neg = invoice.items.map((i) => ({ ...i, unitPriceCents: -i.unitPriceCents }));
    const nc = buildDocument({
      invoice: { ...invoice, kind: "rectificativa", items: neg },
      emitter,
      docType: "03",
      sequence: 1,
      now,
      reference: { docType: "01", clave: f.clave, issuedAt: f.issuedAt, reason: "Error en el importe", total: true },
    });
    expect(nc.totalCents).toBe(f.totalCents);
    expect(nc.xml).toContain(f.clave);
    const v = await validateDocumentXml(nc.xml);
    expect(v.issues ?? []).toEqual([]);
  });

  it("rechaza retención, tarifas no admitidas y clientes sin cédula en factura", () => {
    expect(() => buildDocument({ invoice: { ...invoice, withholdingRate: 2 }, emitter, docType: "01", sequence: 1, now })).toThrow(/retención/);
    expect(() => buildDocument({ invoice: { ...invoice, taxRate: 21 }, emitter, docType: "01", sequence: 1, now })).toThrow(/21 %/);
    expect(() =>
      buildDocument({ invoice: { ...invoice, client: { ...invoice.client, taxId: null } }, emitter, docType: "01", sequence: 1, now }),
    ).toThrow(/identificación/);
  });
});
