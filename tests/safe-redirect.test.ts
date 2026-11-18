import { describe, expect, it } from "vitest";
import { safeNext } from "../src/lib/safe-redirect";

/** Lo que haría el navegador con la ruta devuelta, desde una página de la app. */
const browserTarget = (path: string) => new URL(path, "https://app-abogado.example/login");

describe("safeNext: rutas internas válidas", () => {
  it("conserva ruta, parámetros y ancla", () => {
    expect(safeNext("/expedientes")).toBe("/expedientes");
    expect(safeNext("/expedientes/12?tab=agenda")).toBe("/expedientes/12?tab=agenda");
    expect(safeNext("/agenda?mes=2026-11#dia-18")).toBe("/agenda?mes=2026-11#dia-18");
  });
  it("vacío, ausente o relativo → la ruta por defecto", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null, "/agenda")).toBe("/agenda");
    expect(safeNext("", "/agenda")).toBe("/agenda");
    expect(safeNext("expedientes")).toBe("/");
  });
});

describe("safeNext: nunca sale de la app (OWASP-A01-001)", () => {
  const attacks = [
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example", // reproducido en Chromium: llevaba a evil.example tras iniciar sesión
    "/\t\\evil.example", // ídem
    "/\n/evil.example",
    "/\r\n/evil.example",
    "/\\\\evil.example",
    "/ \t/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/\u0000/evil.example",
  ];
  for (const a of attacks) {
    it(`${JSON.stringify(a)} no lleva a otro dominio`, () => {
      const out = safeNext(a, "/");
      expect(browserTarget(out).host).toBe("app-abogado.example");
    });
  }
  it("una ruta con un tabulador intercalado se normaliza (el navegador lo habría quitado igual)", () => {
    expect(safeNext("/expe\tdientes")).toBe("/expedientes");
  });
});
