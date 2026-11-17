import { normalizePem } from "./connection";

/**
 * Comprobaciones de configuración para el despliegue en producción, con mensajes en castellano que
 * dicen QUÉ cambiar y DÓNDE. Todas se evalúan a la vez para poder corregirlo todo de una pasada.
 * Nunca incluyen contraseñas ni claves en los mensajes.
 */

type Env = Record<string, string | undefined>;

const MIN_PASSWORD = 10; // la misma regla que la pantalla «Equipo»

/** «servidor:puerto, usuario X» de una cadena de conexión, sin la contraseña (apto para el log). */
export function describeDbTarget(url: string | undefined): string {
  try {
    const u = new URL(url ?? "");
    return `${u.hostname}:${u.port || "5432"}, usuario «${decodeURIComponent(u.username)}»`;
  } catch {
    return "cadena no válida";
  }
}

function checkDatabase(env: Env): string[] {
  const p: string[] = [];
  const name = env.MIGRATE_DATABASE_URL ? "MIGRATE_DATABASE_URL" : "DATABASE_URL";
  const raw = env.MIGRATE_DATABASE_URL || env.DATABASE_URL;
  if (!raw) return ["Falta DATABASE_URL: pega la cadena de conexión de la base de datos (en Supabase: botón «Connect» → «Session pooler»)."];
  if (/\s/.test(raw.trim())) p.push(`${name} contiene espacios o saltos de línea: vuelve a copiarla y pégala en una sola línea.`);
  if (/YOUR[-_]PASSWORD|\[|\]/i.test(raw)) {
    p.push(`${name} todavía lleva «[YOUR-PASSWORD]» (o corchetes): sustitúyelo, corchetes incluidos, por la contraseña de la base de datos.`);
  }
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return [...p, `${name} no es una cadena de conexión válida: debe empezar por «postgresql://». Cópiala de nuevo del proveedor.`];
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
    p.push(`${name} debe empezar por «postgresql://» (ahora empieza por «${u.protocol}//»). ¿Pegaste otra dirección, como la URL del proyecto?`);
    return p;
  }
  if (!u.password && !p.length) p.push(`${name} no lleva contraseña: debe tener la forma postgresql://usuario:CONTRASEÑA@servidor:puerto/base.`);

  const host = u.hostname.toLowerCase();
  const isSupabase = host.endsWith(".supabase.co") || host.endsWith(".supabase.com");
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host)) {
    p.push(
      `${name} es la conexión DIRECTA de Supabase (${host}), que usa IPv6 y Render no la alcanza. ` +
        "En Supabase pulsa «Connect» y copia la del «Session pooler» (servidor …pooler.supabase.com, puerto 5432).",
    );
  }
  if (host.endsWith(".pooler.supabase.com")) {
    if (u.port === "6543") {
      p.push(`${name} usa el «Transaction pooler» (puerto 6543). Usa el «Session pooler» (puerto 5432): en Supabase, «Connect» → «Session pooler».`);
    }
    if (!decodeURIComponent(u.username).startsWith("postgres.")) {
      p.push(`En ${name} el usuario debe ser «postgres.<referencia-del-proyecto>» (ahora es «${decodeURIComponent(u.username)}»). Copia la cadena tal cual de Supabase.`);
    }
  }
  if (isSupabase && !env.DATABASE_SSL_CA?.trim()) {
    p.push(
      "Falta DATABASE_SSL_CA: con Supabase hace falta su certificado. En Supabase: Project Settings → Database → SSL Configuration → " +
        "«Download certificate»; ábrelo con el Bloc de notas y pega TODO su contenido (incluidas las líneas BEGIN y END) en una variable DATABASE_SSL_CA.",
    );
  }
  if (env.DATABASE_SSL_CA?.trim()) {
    try {
      normalizePem(env.DATABASE_SSL_CA);
    } catch {
      p.push("DATABASE_SSL_CA no es un certificado completo: debe incluir las líneas «-----BEGIN CERTIFICATE-----» y «-----END CERTIFICATE-----».");
    }
  }
  return p;
}

function checkStorage(env: Env): string[] {
  if ((env.STORAGE_DRIVER ?? "local") !== "s3") return [];
  const p: string[] = [];
  const missing = ["S3_BUCKET", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !env[k]?.trim());
  if (missing.length) p.push(`Faltan datos del almacenamiento de documentos: ${missing.join(", ")} (ver DEPLOY-RENDER.md, sección 3).`);
  const bucket = env.S3_BUCKET?.trim();
  if (bucket && /[\s/]/.test(bucket)) p.push(`S3_BUCKET debe ser solo el nombre del bucket (p. ej. «documentos»), sin espacios ni barras.`);
  for (const k of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
    if (env[k] && /\s/.test(env[k]!.trim())) p.push(`${k} contiene espacios: vuelve a copiarla.`);
  }
  const ep = env.S3_ENDPOINT?.trim();
  if (ep) {
    let u: URL | null = null;
    try {
      u = new URL(ep);
    } catch {
      p.push("S3_ENDPOINT no es una dirección válida: debe empezar por «https://».");
    }
    if (u) {
      if (u.protocol !== "https:") p.push("S3_ENDPOINT debe empezar por «https://».");
      const host = u.hostname.toLowerCase();
      if (host.endsWith(".supabase.co")) {
        if (!host.endsWith(".storage.supabase.co") || !u.pathname.replace(/\/+$/, "").endsWith("/storage/v1/s3")) {
          p.push(
            "S3_ENDPOINT de Supabase debe ser el «Endpoint» del apartado S3 Connection (forma https://<ref>.storage.supabase.co/storage/v1/s3), " +
              "no la URL del proyecto. En Supabase: Project Settings → Storage → S3 Connection.",
          );
        }
        if (env.S3_FORCE_PATH_STYLE !== "true") p.push("Con Supabase Storage, S3_FORCE_PATH_STYLE debe ser «true» (en render.yaml).");
        if (!env.S3_REGION || env.S3_REGION === "auto") p.push("Con Supabase Storage, S3_REGION debe ser la región del proyecto (p. ej. «eu-central-1»), no «auto».");
      }
    }
  }
  return p;
}

function checkFirstAdmin(env: Env): string[] {
  const email = env.SEED_ADMIN_EMAIL?.trim();
  const pass = env.SEED_ADMIN_PASSWORD;
  if (!email && !pass) return [];
  const p: string[] = [];
  if (!email) p.push("Para crear el primer administrador falta SEED_ADMIN_EMAIL (hay contraseña pero no correo).");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) p.push(`SEED_ADMIN_EMAIL no parece un correo válido.`);
  if (!pass) p.push("Para crear el primer administrador falta SEED_ADMIN_PASSWORD (hay correo pero no contraseña).");
  else if (pass.length < MIN_PASSWORD) p.push(`SEED_ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD} caracteres.`);
  return p;
}

/** Todos los problemas de configuración de producción (vacío si todo está bien). */
export function checkDeployConfig(env: Env): string[] {
  return [...checkDatabase(env), ...checkStorage(env), ...checkFirstAdmin(env)];
}

/** Traduce un error de conexión de PostgreSQL a «qué cambiar». */
export function explainDbError(err: unknown): string {
  const e = err as { code?: string; message?: string; address?: string };
  const msg = e?.message ?? String(err);
  const code = e?.code ?? "";
  if (/Tenant or user not found/i.test(msg)) {
    return "Supabase no reconoce el usuario: en la cadena del Session pooler debe ser «postgres.<referencia-del-proyecto>». Cópiala tal cual de Supabase («Connect» → «Session pooler»).";
  }
  if (code === "28P01" || /password authentication failed/i.test(msg)) {
    return "Contraseña incorrecta. Pon en la cadena la contraseña de la base de datos (no la de tu cuenta de Supabase). Si no la recuerdas, cámbiala en Supabase (Project Settings → Database → Reset database password), usando solo letras y números, y actualiza DATABASE_URL.";
  }
  if (/self[- ]signed|unable to verify|unable to get local issuer|certificate has expired/i.test(msg)) {
    return "El certificado del servidor no se pudo verificar: falta DATABASE_SSL_CA o no es el de tu proyecto. En Supabase: Project Settings → Database → SSL Configuration → «Download certificate», y pega todo su contenido en DATABASE_SSL_CA.";
  }
  if (/altnames|does not match certificate/i.test(msg)) {
    return "El certificado del servidor no corresponde a su nombre. No debería ocurrir con Supabase: pásale este mensaje a quien mantiene la app.";
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH" || (e?.address ?? "").includes(":")) {
    return "No hay ruta hasta el servidor. Con Supabase suele ser porque se usó la conexión directa (IPv6): usa la del «Session pooler».";
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return "No existe un servidor con ese nombre. Revisa la cadena: cópiala de nuevo (en Supabase: «Connect» → «Session pooler»).";
  }
  if (code === "ECONNREFUSED") return "El servidor rechazó la conexión: el puerto no es correcto (con el Session pooler de Supabase es 5432).";
  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
    return "La conexión tardó demasiado. ¿Está el proyecto de Supabase en pausa? Reactívalo desde su panel. Si no, revisa servidor y puerto de la cadena.";
  }
  if (code === "3D000") return "La base de datos indicada al final de la cadena no existe (en Supabase se llama «postgres»).";
  if (/max.*(client|connections)|too many (clients|connections)/i.test(msg)) {
    return "El servidor no admite más conexiones ahora mismo. Espera un minuto y vuelve a desplegar.";
  }
  if (/does not support SSL|SSL off/i.test(msg)) return "El servidor no admite conexiones cifradas: quita DATABASE_SSL_CA (o usa un proveedor con SSL).";
  return "Error no reconocido al conectar con la base de datos: pásale este mensaje completo a quien mantiene la app.";
}
