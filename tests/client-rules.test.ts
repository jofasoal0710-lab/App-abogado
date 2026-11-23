import { describe, expect, it } from "vitest";
import { missingClientFields, nameLooksLikeId } from "../src/lib/client-rules";

const full = { type: "persona" as const, name: "Ana Mora", taxId: "1-1234-0567", birthDate: "1990-01-01", maritalStatus: "soltero", email: "a@b.cr", phone: "8888-8888", address: "San José" };

describe("datos obligatorios del cliente", () => {
  it("con todo, no falta nada", () => expect(missingClientFields(full)).toEqual([]));
  it("solo con el nombre, enumera todo lo que falta", () => {
    expect(missingClientFields({ type: "persona", name: "Ana", taxId: null, birthDate: null, maritalStatus: null, email: null, phone: null, address: null })).toEqual([
      "Número de identificación", "Fecha de nacimiento", "Estado civil", "Correo electrónico", "Teléfono", "Dirección",
    ]);
  });
  it("persona jurídica: sin fecha de nacimiento ni estado civil", () => {
    expect(missingClientFields({ ...full, type: "empresa", birthDate: null, maritalStatus: null })).toEqual([]);
  });
  it("espacios en blanco cuentan como vacío", () => expect(missingClientFields({ ...full, phone: "   " })).toEqual(["Teléfono"]));
});

describe("nombre que parece una cédula", () => {
  it("detecta números", () => {
    expect(nameLooksLikeId("504000893")).toBe(true);
    expect(nameLooksLikeId("5-0400-0893")).toBe(true);
    expect(nameLooksLikeId("Ana Mora")).toBe(false);
    expect(nameLooksLikeId("Inversiones 2020 S.A.")).toBe(false);
  });
});
