import { describe, expect, it } from "vitest";
import { checkIntakeFile, magicMatches, nameTokens, namesMatch, normalizeName, parseIntake } from "../src/lib/intake";

const base = {
  clientType: "persona",
  name: "Ana Lucía Mora Vargas",
  email: "Ana@Example.com",
  phone: "8888-1234",
  summary: "Me despidieron sin pagarme la liquidación y quiero saber qué hacer.",
  consent: "on",
  area: "laboral",
};

describe("parseIntake", () => {
  it("acepta un formulario completo y normaliza", () => {
    const r = parseIntake({ ...base, taxId: "1-1234-0567", idType: "cedula_fisica", deadline: "2026-12-01", preferredContact: "whatsapp" }, "2026-11-25");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.email).toBe("ana@example.com");
    expect(r.data.taxId).toBe("112340567");
    expect(r.data.area).toBe("laboral");
    expect(r.data.preferredContact).toBe("whatsapp");
  });

  it("lista todos los errores a la vez", () => {
    const r = parseIntake({ clientType: "persona", name: "A", email: "x", phone: "12", summary: "corto" }, "2026-11-25");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(5);
  });

  it("valida la cédula y la fecha de nacimiento", () => {
    const r = parseIntake({ ...base, taxId: "123", idType: "cedula_fisica", birthDate: "2030-01-01" }, "2026-11-25");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(" ")).toMatch(/fecha de nacimiento/);
  });

  it("valores desconocidos no pasan: área a «otros», contacto y estado civil a null", () => {
    const r = parseIntake({ ...base, area: "hackeo", preferredContact: "fax", maritalStatus: "x" }, "2026-11-25");
    expect(r.ok && r.data.area).toBe("otros");
    expect(r.ok && r.data.preferredContact).toBeNull();
    expect(r.ok && r.data.maritalStatus).toBeNull();
  });

  it("empresa: sin fecha de nacimiento ni estado civil", () => {
    const r = parseIntake({ ...base, clientType: "empresa", name: "Inversiones del Sol S.A.", birthDate: "1990-01-01", maritalStatus: "casado" }, "2026-11-25");
    expect(r.ok && r.data.birthDate).toBeNull();
    expect(r.ok && r.data.maritalStatus).toBeNull();
  });
});

describe("adjuntos", () => {
  it("solo tipos permitidos y tamaño máximo", () => {
    expect(checkIntakeFile("contrato.PDF", 1000).ok).toBe(true);
    expect(checkIntakeFile("virus.exe", 1000).ok).toBe(false);
    expect(checkIntakeFile("pagina.html", 1000).ok).toBe(false);
    expect(checkIntakeFile("grande.pdf", 9 * 1024 * 1024).ok).toBe(false);
    expect(checkIntakeFile("vacio.pdf", 0).ok).toBe(false);
  });
  it("el contenido debe coincidir con la extensión", () => {
    expect(magicMatches("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(magicMatches("application/pdf", new TextEncoder().encode("<html>"))).toBe(false);
    expect(magicMatches("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(magicMatches("application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Uint8Array([0x50, 0x4b, 3, 4]))).toBe(true);
  });
});

describe("nombres para conflictos", () => {
  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normalizeName("  José PÉREZ-Mora ")).toBe("jose perez mora");
    expect(nameTokens("Inversiones del Sol S.A.")).toEqual(["inversiones", "sol"]);
  });
  it("encuentra la misma persona con más o menos apellidos", () => {
    expect(namesMatch("Ana Mora", "Ana Lucía Mora Vargas")).toBe(true);
    expect(namesMatch("ANA LUCIA MORA", "Ana Lucía Mora Vargas")).toBe(true);
    expect(namesMatch("Ana Vargas Solís", "Ana Lucía Mora Vargas")).toBe(false);
    expect(namesMatch("Ana", "Ana Lucía Mora")).toBe(false);
    expect(namesMatch("Inversiones del Sol S.A.", "INVERSIONES DEL SOL SOCIEDAD ANONIMA")).toBe(true);
  });
});
