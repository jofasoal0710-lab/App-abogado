const INTERNAL = "http://interno.invalid";

/**
 * Solo permite rutas internas ("/algo"), nunca URLs externas.
 *
 * No basta con mirar el texto ("empieza por / y no por //"): el navegador ELIMINA tabuladores y saltos
 * de línea al interpretar una URL y trata "\" como "/", así que "/<tab>/sitio.example" o "/\sitio.example"
 * acaban siendo "//sitio.example" (otro dominio). Por eso se interpreta la ruta con el mismo algoritmo
 * que el navegador y se exige que siga en nuestro origen; se devuelve ya normalizada.
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(value, INTERNAL);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
