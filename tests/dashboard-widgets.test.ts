import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, availableWidgets, effectiveLayout, moveItem, sanitizeLayout } from "../src/lib/dashboard-widgets";

const all = () => true;
const noBilling = (p: string) => p !== "facturacion.ver";

describe("panel personalizable", () => {
  it("sin disposición guardada se usa la predeterminada (sin lo que no se puede ver)", () => {
    expect(effectiveLayout(null, all)).toEqual(DEFAULT_LAYOUT);
    // La predeterminada encaja en la cuadrícula de 3 columnas sin huecos (filas completas).
    const span = { s: 1, m: 2, l: 3 } as const;
    expect(DEFAULT_LAYOUT.reduce((n, l) => n + span[l.size], 0) % 3).toBe(0);
    expect(effectiveLayout(null, noBilling).reduce((n, l) => n + span[l.size], 0) % 3).toBe(0);
    const nb = effectiveLayout(null, noBilling).map((l) => l.id);
    expect(nb).not.toContain("cobros");
    expect(nb).not.toContain("facturas_vencidas");
  });
  it("una disposición vacía guardada se respeta (la persona quitó todo)", () => {
    expect(effectiveLayout([], all)).toEqual([]);
  });
  it("limpia lo inválido: ids desconocidos, repetidos, tamaños no permitidos y widgets sin permiso", () => {
    const raw = [{ id: "mis_tareas", size: "l" }, { id: "hackeo", size: "s" }, { id: "mis_tareas", size: "s" }, { id: "cifras", size: "s" }, { id: "cobros", size: "m" }, "basura", null];
    expect(sanitizeLayout(raw, noBilling)).toEqual([{ id: "mis_tareas", size: "l" }, { id: "cifras", size: "l" }]);
    expect(sanitizeLayout("no es lista", all)).toEqual([]);
  });
  it("lista los widgets que se pueden añadir", () => {
    const ids = availableWidgets([{ id: "cifras", size: "l" }], noBilling).map((w) => w.id);
    expect(ids).toContain("primeros_pasos");
    expect(ids).not.toContain("cifras");
    expect(ids).not.toContain("provisiones");
  });
  it("mueve widgets", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 1, 9)).toEqual(["a", "b"].slice(0, 1).concat("b"));
    expect(moveItem(["a"], 5, 0)).toEqual(["a"]);
  });
});
