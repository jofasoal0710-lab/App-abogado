import type { PoolConfig } from "pg";

/**
 * Configuración de conexión a PostgreSQL, común a la app, las migraciones y el seed.
 *
 * Proveedores como Supabase firman el certificado TLS de la base de datos con una CA propia
 * (no reconocida por Node), así que con `?sslmode=require` la conexión se rechaza. La solución
 * segura NO es desactivar la verificación, sino indicar esa CA en `DATABASE_SSL_CA` (contenido
 * PEM del certificado que se descarga del panel del proveedor).
 *
 * Ojo: `pg` aplica los parámetros de la URL (`sslmode`, `sslrootcert`…) POR ENCIMA de la opción
 * `ssl` explícita; por eso, cuando hay CA, se quitan de la URL para que mande el certificado.
 */

export const DEFAULT_DATABASE_URL = "postgres://abogado:abogado@localhost:5432/abogado";

const SSL_URL_PARAMS = ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "sslnegotiation", "uselibpqcompat"];

/** Normaliza el PEM de `DATABASE_SSL_CA` (admite saltos de línea reales o escritos como «\n»). */
export function normalizePem(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const pem = raw.replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").trim();
  if (!pem.includes("-----BEGIN CERTIFICATE-----") || !pem.includes("-----END CERTIFICATE-----")) {
    throw new Error(
      "DATABASE_SSL_CA no es un certificado PEM: debe incluir las líneas «-----BEGIN CERTIFICATE-----» y «-----END CERTIFICATE-----».",
    );
  }
  return pem + "\n";
}

/** Quita de la cadena de conexión los parámetros SSL, conservando el resto (usuario, contraseña, host, otros parámetros). */
export function stripSslParams(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  for (const p of SSL_URL_PARAMS) params.delete(p);
  const rest = params.toString();
  return rest ? `${url.slice(0, q)}?${rest}` : url.slice(0, q);
}

export function pgConfig(env: Record<string, string | undefined> = process.env): PoolConfig {
  const url = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const ca = normalizePem(env.DATABASE_SSL_CA);
  if (!ca) return { connectionString: url };
  // TLS obligatorio y verificado contra esa CA (cadena y nombre del servidor).
  return { connectionString: stripSslParams(url), ssl: { ca, rejectUnauthorized: true } };
}
