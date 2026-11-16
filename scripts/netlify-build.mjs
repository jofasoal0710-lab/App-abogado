// Build para Netlify. Una sola orden para todos los contextos; las decisiones se toman aquí:
//  - Solo el contexto "production" aplica migraciones (los deploy previews y las ramas NUNCA tocan la BD).
//  - En producción se comprueban los ajustes que, si faltan, dejarían una app insegura o que pierde datos.
import { spawnSync } from "node:child_process";

const context = process.env.CONTEXT ?? "local";
const isProd = context === "production";

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
  if (!process.env.DATABASE_URL && !process.env.MIGRATE_DATABASE_URL) {
    fail("Falta DATABASE_URL (cadena de conexión de PostgreSQL).");
  }
  // En Netlify el disco es efímero: con almacenamiento local los documentos se perderían.
  if ((process.env.STORAGE_DRIVER ?? "local") === "local" && process.env.ALLOW_LOCAL_STORAGE !== "true") {
    fail(
      "STORAGE_DRIVER no es «s3»: en Netlify el disco es efímero y los documentos subidos se perderían. " +
        "Configura el almacenamiento S3 (ver DEPLOY.md) o, solo para una prueba desechable, ALLOW_LOCAL_STORAGE=true.",
    );
  }
  if (process.env.SKIP_DB_MIGRATE === "true") {
    console.log("SKIP_DB_MIGRATE=true: no se aplican migraciones (hazlo tú con `npm run db:migrate`).");
  } else {
    console.log("Aplicando migraciones de base de datos (contexto production)…");
    // Para migrar es mejor la conexión directa (sin pooler) si se ha configurado.
    run("npx", ["tsx", "src/db/migrate.ts"], { DATABASE_URL: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL });
  }
} else {
  console.log(`Contexto «${context}»: no se aplican migraciones ni se exigen secretos de producción.`);
}

run("npx", ["next", "build"]);
