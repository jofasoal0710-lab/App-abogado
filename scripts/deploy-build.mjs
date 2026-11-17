// Build para plataformas de alojamiento (Netlify, Render). Una sola orden; las decisiones se toman aquí:
//  - Solo el despliegue de PRODUCCIÓN aplica migraciones (las previews/ramas NUNCA tocan la base de datos).
//  - En producción se comprueban los ajustes que, si faltan, dejarían una app insegura o que pierde datos.
import { spawnSync } from "node:child_process";

// Netlify indica el contexto en CONTEXT; Render marca los previews de pull request con IS_PULL_REQUEST=true.
const onRender = process.env.RENDER === "true";
const context = process.env.CONTEXT ?? (onRender ? (process.env.IS_PULL_REQUEST === "true" ? "preview" : "production") : "local");
const isProd = context === "production";
const platform = onRender ? "Render" : process.env.NETLIFY ? "Netlify" : "local";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (isProd) {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32 || /cambia-esto/i.test(secret)) {
    fail("AUTH_SECRET falta o es demasiado corto/de ejemplo (mínimo 32 caracteres). Genera uno con: openssl rand -base64 32");
  }
  // El disco de Netlify y el del plan gratuito de Render son efímeros: con almacenamiento local, cada
  // reinicio o redespliegue borraría los documentos subidos.
  if ((process.env.STORAGE_DRIVER ?? "local") === "local" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
    fail(
      "STORAGE_DRIVER no es «s3»: en Netlify y en el plan gratuito de Render el disco es efímero y los documentos subidos se perderían. " +
        "Configura el almacenamiento S3 (ver DEPLOY.md / DEPLOY-RENDER.md) o, si usas un disco persistente de pago, define ALLOW_LOCAL_STORAGE=true y UPLOAD_DIR.",
    );
  }
  // Base de datos, almacenamiento y primer administrador: todos los problemas a la vez, en castellano.
  run("npx", ["tsx", "src/db/preflight.ts"]);
  if (process.env.SKIP_DB_MIGRATE === "true") {
    console.log("SKIP_DB_MIGRATE=true: no se aplican migraciones (hazlo tú con `npm run db:migrate`).");
  } else {
    console.log(`Aplicando migraciones de base de datos (${platform}, producción)…`);
    // Para migrar es mejor la conexión directa (sin pooler) si se ha configurado.
    run("npx", ["tsx", "src/db/migrate.ts"], { DATABASE_URL: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL });
  }
  // Primer administrador desde el panel (sin instalar nada en local): solo si la base de datos aún no
  // tiene NINGÚN usuario; en los despliegues siguientes no hace nada. Nunca con datos de demostración.
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    console.log("Primer administrador (SEED_ADMIN_EMAIL): se crea solo si todavía no hay usuarios…");
    run("npx", ["tsx", "src/db/seed.ts"]);
  }
} else {
  console.log(`Despliegue «${context}» (${platform}): no se aplican migraciones ni se exigen secretos de producción.`);
}

run("npx", ["next", "build"]);
