/**
 * Panel de inicio personalizable: catálogo de widgets y validación de la disposición elegida por cada
 * persona (qué widgets, en qué orden y de qué tamaño). Lógica pura, sin base de datos.
 */
import type { Permission } from "./permissions";

export type WidgetSize = "s" | "m" | "l";
export type WidgetId =
  | "primeros_pasos"
  | "accesos"
  | "cifras"
  | "proximos"
  | "mis_tareas"
  | "audiencias"
  | "mis_horas"
  | "calendario"
  | "mis_expedientes"
  | "actividad"
  | "areas"
  | "estados"
  | "cobros"
  | "facturas_vencidas"
  | "provisiones";

export type WidgetDef = {
  id: WidgetId;
  title: string;
  description: string;
  icon: string;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  permission?: Permission;
};

export const WIDGETS: readonly WidgetDef[] = [
  { id: "primeros_pasos", title: "Primeros pasos", description: "Guía para empezar: qué hacer primero y qué te falta por probar.", icon: "conocimiento", sizes: ["m", "l"], defaultSize: "l" },
  { id: "accesos", title: "Accesos rápidos", description: "Botones grandes para lo que más se usa: nuevo expediente, cliente, horas, tarea…", icon: "panel", sizes: ["s", "m", "l"], defaultSize: "l" },
  { id: "cifras", title: "Cifras clave", description: "Expedientes activos, plazos de la semana, horas sin facturar y pendiente de cobro.", icon: "actividad", sizes: ["l"], defaultSize: "l" },
  { id: "proximos", title: "Mis próximos 14 días", description: "Tus plazos, audiencias, reuniones y tareas con cuenta atrás.", icon: "agenda", sizes: ["s", "m", "l"], defaultSize: "m" },
  { id: "mis_tareas", title: "Mis tareas", description: "Lo que tienes pendiente y en curso, con las vencidas primero.", icon: "tareas", sizes: ["s", "m", "l"], defaultSize: "s" },
  { id: "audiencias", title: "Audiencias de la semana", description: "Las audiencias de los próximos 7 días, con sala virtual si la hay.", icon: "balanza", sizes: ["s", "m", "l"], defaultSize: "s" },
  { id: "mis_horas", title: "Mis horas", description: "Horas registradas hoy, esta semana y este mes, y el cronómetro.", icon: "horas", sizes: ["s", "m", "l"], defaultSize: "s" },
  { id: "calendario", title: "Calendario del mes", description: "Vista mensual con los eventos de cada día.", icon: "agenda", sizes: ["s", "m", "l"], defaultSize: "m" },
  { id: "mis_expedientes", title: "Mis expedientes", description: "Los expedientes activos de los que eres responsable.", icon: "expedientes", sizes: ["s", "m", "l"], defaultSize: "s" },
  { id: "actividad", title: "Actividad reciente", description: "Lo último: documentos, notas, horas y cobros.", icon: "actividad", sizes: ["s", "m", "l"], defaultSize: "s" },
  { id: "areas", title: "Expedientes por área", description: "Gráfico de los expedientes activos por materia.", icon: "expedientes", sizes: ["s", "m"], defaultSize: "s" },
  { id: "estados", title: "Estado de los expedientes", description: "Cuántos hay abiertos, en curso, en espera y cerrados.", icon: "expedientes", sizes: ["s", "m"], defaultSize: "s" },
  { id: "cobros", title: "Cobros por mes", description: "Lo cobrado en los últimos 6 meses.", icon: "cobro", sizes: ["s", "m", "l"], defaultSize: "s", permission: "facturacion.ver" },
  { id: "facturas_vencidas", title: "Facturas vencidas", description: "Facturas que pasaron su vencimiento sin cobrarse.", icon: "facturas", sizes: ["s", "m"], defaultSize: "s", permission: "facturacion.ver" },
  { id: "provisiones", title: "Provisiones bajas", description: "Expedientes cuya provisión de fondos está agotada o bajo el mínimo.", icon: "cobro", sizes: ["s", "m"], defaultSize: "s", permission: "facturacion.ver" },
];

export const WIDGET_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));
export const SIZE_LABELS: Record<WidgetSize, string> = { s: "Pequeño (1/3)", m: "Mediano (2/3)", l: "Ancho (todo)" };

export type LayoutItem = { id: WidgetId; size: WidgetSize };

/** Disposición de partida (la del panel de siempre, más los widgets nuevos más útiles). */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "cifras", size: "l" },
  { id: "proximos", size: "m" },
  { id: "mis_tareas", size: "s" },
  { id: "calendario", size: "m" },
  { id: "audiencias", size: "s" },
  { id: "mis_horas", size: "s" },
  { id: "areas", size: "s" },
  { id: "estados", size: "s" },
  { id: "mis_expedientes", size: "s" },
  { id: "actividad", size: "m" },
  // Facturación (solo con permiso): una fila completa, así el panel encaja con y sin ella.
  { id: "cobros", size: "s" },
  { id: "facturas_vencidas", size: "s" },
  { id: "provisiones", size: "s" },
];

/**
 * Limpia una disposición (de la base de datos o del navegador): solo widgets que existen y que la
 * persona puede ver, sin repetidos, con un tamaño permitido. Nunca falla: lo inválido se descarta.
 */
export function sanitizeLayout(raw: unknown, allowed: (p: Permission) => boolean): LayoutItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of raw.slice(0, 40)) {
    if (!it || typeof it !== "object") continue;
    const id = (it as { id?: unknown }).id;
    const def = typeof id === "string" ? WIDGET_BY_ID.get(id as WidgetId) : undefined;
    if (!def || seen.has(def.id) || (def.permission && !allowed(def.permission))) continue;
    seen.add(def.id);
    const size = (it as { size?: unknown }).size;
    out.push({ id: def.id, size: def.sizes.includes(size as WidgetSize) ? (size as WidgetSize) : def.defaultSize });
  }
  return out;
}

/** La disposición que se muestra: la guardada (limpia) o, si no hay ninguna, la predeterminada. */
export function effectiveLayout(saved: unknown, allowed: (p: Permission) => boolean): LayoutItem[] {
  if (saved == null) return sanitizeLayout(DEFAULT_LAYOUT, allowed);
  return sanitizeLayout(saved, allowed);
}

/** Widgets que se pueden añadir (los que la persona ve y aún no están en su panel). */
export function availableWidgets(layout: LayoutItem[], allowed: (p: Permission) => boolean): WidgetDef[] {
  const used = new Set(layout.map((l) => l.id));
  return WIDGETS.filter((w) => !used.has(w.id) && (!w.permission || allowed(w.permission)));
}

/** Mueve un widget a otra posición (para arrastrar o para los botones ↑ ↓). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const out = [...list];
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, it);
  return out;
}
