/**
 * Consulta pública de contribuyentes del Ministerio de Hacienda (sin dependencias de servidor: la usan la
 * ruta /api/hacienda y, si Hacienda rechaza al servidor, el propio navegador).
 *
 * Hacienda responde 403 a peticiones que vienen de algunos centros de datos fuera de la región (p. ej. el
 * servidor de Render en Frankfurt). Su servicio admite peticiones desde cualquier web (CORS «*»), así que en
 * ese caso la consulta la hace el navegador de quien usa la app, que normalmente está en Costa Rica.
 */
export const HACIENDA_PUBLIC_URL = "https://api.hacienda.go.cr/fe/ae";
export const HACIENDA_ORIGIN = "https://api.hacienda.go.cr";

const TYPE_BY_CODE: Record<string, string> = { "01": "cedula_fisica", "02": "cedula_juridica", "03": "dimex", "04": "nite" };

export type HaciendaResult = { name: string; idType: string | null; status: string | null };

/** Interpreta la respuesta JSON de Hacienda (nombre, tipo de identificación y situación). */
export function parseHacienda(data: unknown): HaciendaResult | null {
  const d = (data ?? {}) as { nombre?: unknown; tipoIdentificacion?: unknown; situacion?: { estado?: unknown } };
  const name = typeof d.nombre === "string" ? d.nombre.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!name) return null;
  const code = typeof d.tipoIdentificacion === "string" ? d.tipoIdentificacion : "";
  const status = typeof d.situacion?.estado === "string" ? d.situacion.estado.slice(0, 60) : null;
  return { name, idType: TYPE_BY_CODE[code] ?? null, status };
}
