import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, normalizePem, pgConfig, stripSslParams } from "../src/db/connection";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBfakeBASE64==\n-----END CERTIFICATE-----";

describe("normalizePem", () => {
  it("vacío o ausente → sin CA", () => {
    expect(normalizePem(undefined)).toBeNull();
    expect(normalizePem("")).toBeNull();
    expect(normalizePem("   \n")).toBeNull();
  });
  it("admite saltos de línea reales, «\\n» escritos y CRLF", () => {
    expect(normalizePem(PEM)).toBe(PEM + "\n");
    expect(normalizePem(PEM.replace(/\n/g, "\\n"))).toBe(PEM + "\n");
    expect(normalizePem(PEM.replace(/\n/g, "\r\n"))).toBe(PEM + "\n");
    expect(normalizePem(`  ${PEM}  \n`)).toBe(PEM + "\n");
  });
  it("rechaza con un mensaje claro algo que no es un certificado", () => {
    expect(() => normalizePem("postgresql://usuario:clave@host/db")).toThrow(/DATABASE_SSL_CA/);
    expect(() => normalizePem("-----BEGIN CERTIFICATE-----\nsin final")).toThrow(/END CERTIFICATE/);
  });
});

describe("stripSslParams", () => {
  it("quita los parámetros SSL y conserva el resto", () => {
    expect(stripSslParams("postgresql://u:p@h:5432/db?sslmode=require")).toBe("postgresql://u:p@h:5432/db");
    expect(stripSslParams("postgresql://u:p@h/db?sslmode=require&channel_binding=require")).toBe("postgresql://u:p@h/db?channel_binding=require");
    expect(stripSslParams("postgresql://u:p@h/db?application_name=app&sslrootcert=/x.crt&ssl=true")).toBe("postgresql://u:p@h/db?application_name=app");
  });
  it("no toca usuario ni contraseña (incluidos los codificados) ni una URL sin parámetros", () => {
    const url = "postgresql://postgres.abcd1234:p%40ss%2Fw0rd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
    expect(stripSslParams(url)).toBe(url);
    expect(stripSslParams(url + "?sslmode=verify-full")).toBe(url);
  });
});

describe("pgConfig", () => {
  it("sin variables usa la base de datos local", () => {
    expect(pgConfig({})).toEqual({ connectionString: DEFAULT_DATABASE_URL });
  });
  it("sin CA deja la cadena tal cual (Neon, Render, servidor propio…)", () => {
    const url = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    expect(pgConfig({ DATABASE_URL: url })).toEqual({ connectionString: url });
  });
  it("con CA: TLS obligatorio y verificado, y la URL ya no puede anularlo con sslmode", () => {
    const c = pgConfig({ DATABASE_URL: "postgresql://u:p@h:5432/postgres?sslmode=require", DATABASE_SSL_CA: PEM });
    expect(c.connectionString).toBe("postgresql://u:p@h:5432/postgres");
    expect(c.ssl).toEqual({ ca: PEM + "\n", rejectUnauthorized: true });
  });
  it("una CA mal pegada detiene el arranque (no se conecta sin verificar en silencio)", () => {
    expect(() => pgConfig({ DATABASE_URL: "postgresql://u:p@h/db", DATABASE_SSL_CA: "no es un pem" })).toThrow(/DATABASE_SSL_CA/);
  });
});
