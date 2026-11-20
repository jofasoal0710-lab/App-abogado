/**
 * Apariencia: modo (claro, oscuro o el del sistema), paleta de colores y estilo de la barra lateral.
 * Se guarda en la cuenta de cada persona y en una cookie (para pintar la página ya con sus colores,
 * sin parpadeo). Los colores están en globals.css.
 */
export const THEME_MODES = { light: "Claro", dark: "Oscuro", system: "Automático (como el sistema)" } as const;
export type ThemeMode = keyof typeof THEME_MODES;

export const PALETTES = {
  azul: { label: "Azul despacho", swatch: ["#1f57b8", "#1a4794", "#d9e7fc"] },
  esmeralda: { label: "Esmeralda", swatch: ["#047857", "#065f46", "#d1fae5"] },
  turquesa: { label: "Turquesa", swatch: ["#0f766e", "#115e59", "#ccfbf1"] },
  vino: { label: "Vino", swatch: ["#a82645", "#8c1d3a", "#fbe4e8"] },
  morado: { label: "Morado", swatch: ["#7c3aed", "#6d28d9", "#ede9fe"] },
  terracota: { label: "Terracota", swatch: ["#b04a28", "#8f3c22", "#fae7dd"] },
  grafito: { label: "Grafito", swatch: ["#475569", "#334155", "#f1f5f9"] },
} as const;
export type Palette = keyof typeof PALETTES;

export const SIDEBARS = { color: "Del color de la paleta", oscura: "Oscura", clara: "Clara" } as const;
export type SidebarStyle = keyof typeof SIDEBARS;

export type Theme = { mode: ThemeMode; palette: Palette; sidebar: SidebarStyle };
export const DEFAULT_THEME: Theme = { mode: "light", palette: "azul", sidebar: "color" };
export const THEME_COOKIE = "apariencia";

const has = <T extends object>(o: T, k: unknown): k is keyof T => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);

/** Valores seguros (cualquier cosa desconocida vuelve al valor por defecto). */
export function normalizeTheme(t: { mode?: unknown; palette?: unknown; sidebar?: unknown } | null | undefined): Theme {
  return {
    mode: has(THEME_MODES, t?.mode) ? t!.mode : DEFAULT_THEME.mode,
    palette: has(PALETTES, t?.palette) ? t!.palette : DEFAULT_THEME.palette,
    sidebar: has(SIDEBARS, t?.sidebar) ? t!.sidebar : DEFAULT_THEME.sidebar,
  };
}

/** Cookie «modo.paleta.barra» (p. ej. «dark.vino.oscura»). */
export function themeToCookie(t: Theme): string {
  return `${t.mode}.${t.palette}.${t.sidebar}`;
}
export function themeFromCookie(v: string | undefined): Theme {
  const [mode, palette, sidebar] = (v ?? "").split(".");
  return normalizeTheme({ mode, palette, sidebar });
}
