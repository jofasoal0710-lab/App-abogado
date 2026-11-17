import { describe, expect, it } from "vitest";
import { checkDeployConfig, describeDbTarget, explainDbError } from "../src/db/deploy-checks";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfake==\n-----END CERTIFICATE-----";
const POOLER = "postgresql://postgres.abcdefghijklmnop:Clave123abc@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
const S3_OK = {
  STORAGE_DRIVER: "s3",
  S3_BUCKET: "documentos",
  S3_ENDPOINT: "https://abcdefghijklmnop.storage.supabase.co/storage/v1/s3",
  S3_REGION: "eu-central-1",
  S3_FORCE_PATH_STYLE: "true",
  S3_ACCESS_KEY_ID: "id123",
  S3_SECRET_ACCESS_KEY: "secreto123",
};
const OK = { DATABASE_URL: POOLER, DATABASE_SSL_CA: PEM, ...S3_OK };
const problems = (over: Record<string, string | undefined>) => checkDeployConfig({ ...OK, ...over });

describe("checkDeployConfig: configuración correcta", () => {
  it("Supabase (Session pooler + certificado) y Supabase Storage → sin problemas", () => {
    expect(checkDeployConfig(OK)).toEqual([]);
  });
  it("Neon con sslmode=require y Cloudflare R2 → sin problemas (no exige certificado)", () => {
    expect(
      checkDeployConfig({
        DATABASE_URL: "postgresql://u:p@ep-x-123.eu-central-1.aws.neon.tech/neondb?sslmode=require",
        STORAGE_DRIVER: "s3", S3_BUCKET: "docs", S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com", S3_REGION: "auto",
        S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "b",
      }),
    ).toEqual([]);
  });
});

describe("checkDeployConfig: base de datos", () => {
  it("falta DATABASE_URL", () => {
    expect(problems({ DATABASE_URL: undefined })[0]).toMatch(/Falta DATABASE_URL/);
  });
  it("se dejó [YOUR-PASSWORD]", () => {
    expect(problems({ DATABASE_URL: POOLER.replace("Clave123abc", "[YOUR-PASSWORD]") }).join(" ")).toMatch(/YOUR-PASSWORD.*corchetes/);
  });
  it("conexión directa de Supabase (IPv6)", () => {
    expect(problems({ DATABASE_URL: "postgresql://postgres:Clave123abc@db.abcdefghijklmnop.supabase.co:5432/postgres" }).join(" ")).toMatch(/DIRECTA.*Session pooler/);
  });
  it("Transaction pooler (6543) y usuario sin la referencia del proyecto", () => {
    const p = problems({ DATABASE_URL: "postgresql://postgres:Clave123abc@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" }).join(" ");
    expect(p).toMatch(/Transaction pooler/);
    expect(p).toMatch(/postgres\.<referencia-del-proyecto>/);
  });
  it("Supabase sin certificado, o con un certificado incompleto", () => {
    expect(problems({ DATABASE_SSL_CA: undefined }).join(" ")).toMatch(/Falta DATABASE_SSL_CA/);
    expect(problems({ DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\nMIIB" }).join(" ")).toMatch(/no es un certificado completo/);
  });
  it("pegada con espacios, sin contraseña, o con otra dirección (la URL del proyecto)", () => {
    expect(problems({ DATABASE_URL: POOLER + " \n" + "x" }).join(" ")).toMatch(/espacios/);
    expect(problems({ DATABASE_URL: "postgresql://postgres.abcdefghijklmnop@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" }).join(" ")).toMatch(/no lleva contraseña/);
    expect(problems({ DATABASE_URL: "https://abcdefghijklmnop.supabase.co" }).join(" ")).toMatch(/postgresql:\/\//);
  });
  it("los mensajes nunca muestran la contraseña", () => {
    const all = problems({ DATABASE_URL: "postgresql://postgres:SuperSecreta99@aws-0-eu-central-1.pooler.supabase.com:6543/postgres", DATABASE_SSL_CA: undefined });
    expect(all.length).toBeGreaterThan(1);
    expect(all.join(" ")).not.toContain("SuperSecreta99");
  });
});

describe("checkDeployConfig: almacenamiento", () => {
  it("faltan datos del bucket (todos listados a la vez)", () => {
    expect(problems({ S3_BUCKET: undefined, S3_SECRET_ACCESS_KEY: "" }).join(" ")).toMatch(/S3_BUCKET, S3_SECRET_ACCESS_KEY/);
  });
  it("con Supabase: la URL del proyecto en vez del endpoint S3, estilo de ruta y región", () => {
    const p = problems({ S3_ENDPOINT: "https://abcdefghijklmnop.supabase.co", S3_FORCE_PATH_STYLE: undefined, S3_REGION: "auto" }).join(" ");
    expect(p).toMatch(/no la URL del proyecto/);
    expect(p).toMatch(/S3_FORCE_PATH_STYLE/);
    expect(p).toMatch(/S3_REGION/);
  });
  it("el bucket con barras o el endpoint sin https", () => {
    expect(problems({ S3_BUCKET: "documentos/" }).join(" ")).toMatch(/solo el nombre del bucket/);
    expect(problems({ S3_ENDPOINT: "http://abc.r2.cloudflarestorage.com" }).join(" ")).toMatch(/https/);
  });
  it("sin S3 (disco local permitido) no se exige nada de esto", () => {
    expect(checkDeployConfig({ DATABASE_URL: "postgresql://u:p@localhost/db", STORAGE_DRIVER: "local" })).toEqual([]);
  });
});

describe("checkDeployConfig: primer administrador desde el panel", () => {
  it("es opcional; si se usa, hacen falta correo válido y contraseña de al menos 10 caracteres", () => {
    expect(problems({ SEED_ADMIN_EMAIL: "yo@despacho.es", SEED_ADMIN_PASSWORD: "una-clave-larga" })).toEqual([]);
    expect(problems({ SEED_ADMIN_EMAIL: "yo@despacho.es" }).join(" ")).toMatch(/falta SEED_ADMIN_PASSWORD/);
    expect(problems({ SEED_ADMIN_PASSWORD: "una-clave-larga" }).join(" ")).toMatch(/falta SEED_ADMIN_EMAIL/);
    expect(problems({ SEED_ADMIN_EMAIL: "yo@despacho.es", SEED_ADMIN_PASSWORD: "corta" }).join(" ")).toMatch(/al menos 10/);
    expect(problems({ SEED_ADMIN_EMAIL: "no-es-un-correo", SEED_ADMIN_PASSWORD: "una-clave-larga" }).join(" ")).toMatch(/correo válido/);
  });
});

describe("explainDbError", () => {
  const ex = (o: object) => explainDbError(Object.assign(new Error((o as { message?: string }).message ?? "x"), o));
  it("traduce los errores típicos a qué cambiar", () => {
    expect(ex({ message: "Tenant or user not found" })).toMatch(/postgres\.<referencia-del-proyecto>/);
    expect(ex({ code: "28P01", message: 'password authentication failed for user "postgres"' })).toMatch(/Contraseña incorrecta/);
    // mensajes reales capturados en la prueba local de SSL
    expect(ex({ message: "unable to verify the first certificate" })).toMatch(/DATABASE_SSL_CA/);
    expect(ex({ message: "self-signed certificate in certificate chain" })).toMatch(/DATABASE_SSL_CA/);
    expect(ex({ message: "Hostname/IP does not match certificate's altnames: IP: 127.0.0.1 is not in the cert's list: " })).toMatch(/no corresponde a su nombre/);
    expect(ex({ code: "ENETUNREACH", message: "connect ENETUNREACH 2a05:d014::1:5432" })).toMatch(/Session pooler/);
    expect(ex({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND x" })).toMatch(/No existe un servidor/);
    expect(ex({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" })).toMatch(/puerto/);
    expect(ex({ message: "Connection terminated due to connection timeout" })).toMatch(/pausa/);
    expect(ex({ code: "3D000", message: 'database "x" does not exist' })).toMatch(/postgres/);
    expect(ex({ message: "algo raro" })).toMatch(/no reconocido/);
  });
});

describe("describeDbTarget", () => {
  it("muestra servidor, puerto y usuario, nunca la contraseña", () => {
    const d = describeDbTarget(POOLER);
    expect(d).toBe("aws-0-eu-central-1.pooler.supabase.com:5432, usuario «postgres.abcdefghijklmnop»");
    expect(d).not.toContain("Clave123abc");
    expect(describeDbTarget("no es una url")).toBe("cadena no válida");
  });
});
