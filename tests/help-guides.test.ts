import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES, TOURS, getTour, guideFor, searchGuides } from "../src/lib/help/guides";

/** Todas las rutas de páginas de la app (con un número de ejemplo en los segmentos dinámicos). */
function pageRoutes(dir = "src/app/(app)", base = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const seg = name.startsWith("[") ? (name === "[key]" ? "ley-2" : name === "[mov]" ? "3" : "7") : name;
      out.push(...pageRoutes(p, `${base}/${seg}`));
    } else if (name === "page.tsx") out.push(base || "/");
  }
  return out;
}

describe("centro de ayuda", () => {
  const SIN_GUIA = new Set(["/ayuda", "/expedientes/7/provision/3"]); // el propio centro y un recibo imprimible
  for (const route of pageRoutes()) {
    if (SIN_GUIA.has(route)) continue;
    it(`la pantalla ${route} tiene su ayuda`, () => expect(guideFor(route)).not.toBeNull());
  }
  it("cada ruta va a la guía correcta", () => {
    const cases: [string, string][] = [
      ["/", "panel"], ["/expedientes", "expedientes"], ["/expedientes/nuevo", "expedientes"], ["/expedientes/12", "expediente"], ["/expedientes/12/editar", "expediente"],
      ["/expedientes/12/contestar", "contestar"], ["/expedientes/12/contestar/3", "contestar"], ["/expedientes/12/plantilla-word", "plantillas-word"], ["/formularios", "formularios"],
      ["/formularios/plantillas", "plantillas-word"], ["/formularios/contestacion-demanda", "formularios"], ["/escritos/4", "formularios"], ["/clientes/3/editar", "clientes"],
      ["/facturas/electronica", "facturas"], ["/notaria/indice", "notaria"], ["/seguridad/respaldos", "seguridad"], ["/solicitudes/2/aceptar", "solicitudes"], ["/agenda/audiencias", "agenda"],
    ];
    for (const [r, k] of cases) expect(guideFor(r)?.key, r).toBe(k);
  });
  it("los recorridos que citan las guías existen y tienen pasos", () => {
    for (const g of GUIDES) if (g.tour) expect(getTour(g.tour), g.key).not.toBeNull();
    for (const t of TOURS) {
      expect(t.steps.length).toBeGreaterThan(2);
      expect(t.path.startsWith("/")).toBe(true);
    }
  });
  it("claves únicas y contenido completo", () => {
    expect(new Set(GUIDES.map((g) => g.key)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.summary.length, g.key).toBeGreaterThan(30);
      expect(g.howTo.length, g.key).toBeGreaterThan(0);
      for (const h of g.howTo) expect(h.steps.length, `${g.key}: ${h.title}`).toBeGreaterThan(0);
    }
  });
  it("el buscador encuentra lo que se pide", () => {
    const top = (q: string) => searchGuides(q)[0]?.guide.key;
    expect(top("emitir una factura")).toBe("facturas");
    expect(top("cronómetro")).toBe("horas");
    expect(top("verificación en dos pasos")).toBe("cuenta");
    expect(top("portal del cliente")).toBe("clientes");
    expect(top("contestar demanda")).toBe("contestar");
    expect(top("plantilla word")).toBe("plantillas-word");
    expect(top("índice notarial")).toBe("notaria");
    expect(top("personalizar el panel")).toBe("panel");
    expect(searchGuides("xx")).toEqual([]);
  });
});
