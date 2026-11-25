/**
 * Política de seguridad de contenido (CSP, OWASP-A02-001).
 *
 * Solo se ejecutan los scripts que llevan el «nonce» aleatorio de cada respuesta (los de Next.js lo
 * reciben automáticamente) y los que estos cargan ('strict-dynamic'). Un HTML inyectado (p. ej. un
 * `<img onerror=…>` colado en un campo) no se ejecuta. Además: nada de incrustar la app en otra web,
 * ni plugins, ni cambiar la URL base, ni enviar formularios a otro dominio.
 */
type Env = Record<string, string | undefined>;

/** Orígenes del almacenamiento S3 a los que el navegador sube los documentos directamente. */
export function s3Origins(env: Env): string[] {
  if (env.STORAGE_DRIVER !== "s3") return [];
  const bucket = env.S3_BUCKET?.trim();
  const endpoint = env.S3_ENDPOINT?.trim();
  try {
    if (endpoint) {
      const u = new URL(endpoint);
      const out = [u.origin];
      // Direcciones de estilo «host virtual»: https://<bucket>.<host>
      if (env.S3_FORCE_PATH_STYLE !== "true" && bucket) out.push(`${u.protocol}//${bucket}.${u.host}`);
      return out;
    }
    if (!bucket) return [];
    const region = env.S3_REGION && env.S3_REGION !== "auto" ? env.S3_REGION : "us-east-1";
    return [`https://${bucket}.s3.${region}.amazonaws.com`, `https://${bucket}.s3.amazonaws.com`];
  } catch {
    return [];
  }
}

export function buildCsp(nonce: string, env: Env = process.env): string {
  const dev = env.NODE_ENV === "development";
  // Cloudflare Turnstile (anti-robots), solo si está configurado: su script y su marco.
  const turnstile = env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim() ? " https://challenges.cloudflare.com" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${turnstile}${dev ? " 'unsafe-eval'" : ""}`,
    `frame-src 'self'${turnstile}`,
    // Estilos en línea (atributos style de React): no ejecutan código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${["'self'", ...s3Origins(env), ...(dev ? ["ws:"] : [])].join(" ")}`,
    // Solo el service worker propio (public/sw.js), que no guarda datos privados.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
