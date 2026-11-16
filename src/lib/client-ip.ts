/**
 * IP del cliente, para el limitador de intentos de login.
 *
 * Una cabecera que cualquiera puede enviar NO es una IP fiable. Cada plataforma pone la suya, así que
 * solo se confía en la que se configure expresamente con CLIENT_IP_HEADER (p. ej. `x-nf-client-connection-ip`
 * en Netlify). Si no se configura, se usa el primer valor de X-Forwarded-For, que un atacante puede falsear;
 * por eso existe además el límite por correo, que no depende de la IP.
 */
export function clientIp(
  get: (name: string) => string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const first = (v: string | null | undefined) => v?.split(",")[0]?.trim().slice(0, 64) || undefined;

  const configured = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (configured) {
    const v = first(get(configured));
    if (v) return v;
  }
  if (env.NETLIFY === "true") {
    const v = first(get("x-nf-client-connection-ip"));
    if (v) return v;
  }
  return first(get("x-forwarded-for")) ?? "local";
}
