import "server-only";
import {
  ApiError,
  AuthenticationError,
  Environment,
  extractRejectionReason,
  getEnvironmentConfig,
  getStatus,
  HttpClient,
  loadCredentials,
  signXml,
  submitDocument,
  TokenManager,
  validateDocumentXml,
} from "@dojocoding/hacienda-sdk";

/**
 * Conexión directa con Hacienda (API de recepción de comprobantes, v4.4).
 *
 * Las credenciales viven SOLO en variables de entorno del servidor (panel de Render), nunca en la base de
 * datos ni en el navegador:
 *   HACIENDA_ENV            pruebas (por defecto) | produccion
 *   HACIENDA_USERNAME       usuario del API generado en ATV / TRIBU-CR (cpf-… o cpj-…)
 *   HACIENDA_PASSWORD       contraseña de ese usuario
 *   HACIENDA_P12_BASE64     la llave criptográfica (.p12) en base64
 *   HACIENDA_P12_PIN        el PIN de la llave
 * Para pruebas locales se pueden apuntar las URL a un simulador: HACIENDA_RECEPCION_URL, HACIENDA_IDP_URL.
 */
export type HaciendaEnv = "pruebas" | "produccion";

export function haciendaEnv(): HaciendaEnv {
  return process.env.HACIENDA_ENV === "produccion" ? "produccion" : "pruebas";
}

const REQUIRED = ["HACIENDA_USERNAME", "HACIENDA_PASSWORD", "HACIENDA_P12_BASE64", "HACIENDA_P12_PIN"] as const;

/** Qué variables faltan (solo los nombres; nunca se devuelve un valor). */
export function missingCredentials(): string[] {
  return REQUIRED.filter((k) => !process.env[k]?.trim());
}

function envConfig() {
  const base = getEnvironmentConfig(haciendaEnv() === "produccion" ? Environment.Production : Environment.Sandbox);
  return {
    ...base,
    apiBaseUrl: process.env.HACIENDA_RECEPCION_URL || base.apiBaseUrl,
    idpTokenUrl: process.env.HACIENDA_IDP_URL || base.idpTokenUrl,
  };
}

export class HaciendaFailure extends Error {
  constructor(
    message: string,
    /** true si Hacienda seguro que NO recibió el comprobante (se puede reintentar con otro consecutivo). */
    readonly notReceived: boolean,
  ) {
    super(message);
  }
}

/** Hacienda explica los errores en la cabecera X-Error-Cause: la capturamos para mostrarla. */
function fetchCapturingCause(box: { cause?: string }): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    const cause = res.headers.get("x-error-cause");
    if (cause) box.cause = cause.slice(0, 500);
    return res;
  };
}

let cached: { key: string; tokens: TokenManager } | null = null;

async function client(box: { cause?: string }) {
  const missing = missingCredentials();
  if (missing.length) throw new HaciendaFailure(`Faltan credenciales de Hacienda en el servidor: ${missing.join(", ")}.`, true);
  const cfg = envConfig();
  const username = process.env.HACIENDA_USERNAME!.trim();
  const key = `${cfg.idpTokenUrl}|${username}`;
  if (!cached || cached.key !== key) {
    const tokens = new TokenManager({ envConfig: cfg, requestTimeoutMs: 15_000 });
    try {
      await tokens.authenticate(loadCredentials({ username, password: process.env.HACIENDA_PASSWORD! }));
    } catch (e) {
      throw new HaciendaFailure(
        e instanceof AuthenticationError
          ? "Hacienda rechazó el usuario o la contraseña del API. Revisa HACIENDA_USERNAME y HACIENDA_PASSWORD (y que sean del ambiente correcto)."
          : "No se pudo conectar con el servicio de autenticación de Hacienda. Inténtalo más tarde.",
        true,
      );
    }
    cached = { key, tokens };
  }
  return new HttpClient({ envConfig: cfg, tokenManager: cached.tokens, fetchFn: fetchCapturingCause(box), requestTimeoutMs: 30_000 });
}

/** «Probar conexión»: solo pide un token, no envía nada. */
export async function testConnection(): Promise<void> {
  cached = null;
  await client({});
}

/** Comprueba la llave .p12 y su PIN firmando el XML; luego vuelve a validar contra el esquema. */
export async function signDocument(xml: string): Promise<string> {
  const missing = missingCredentials();
  if (missing.length) throw new HaciendaFailure(`Faltan credenciales de Hacienda en el servidor: ${missing.join(", ")}.`, true);
  let signed: string;
  try {
    signed = await signXml(xml, Buffer.from(process.env.HACIENDA_P12_BASE64!.replace(/\s/g, ""), "base64"), process.env.HACIENDA_P12_PIN!);
  } catch {
    throw new HaciendaFailure("No se pudo firmar con la llave criptográfica. Revisa HACIENDA_P12_BASE64 y HACIENDA_P12_PIN.", true);
  }
  const v = await validateDocumentXml(signed, { requireSignature: true });
  if (!v.valid) throw new HaciendaFailure(`El comprobante no cumple el esquema de Hacienda: ${(v.issues ?? []).slice(0, 3).join("; ")}`, true);
  return signed;
}

export type SendInput = {
  clave: string;
  issuedAt: string;
  emitter: { tipo: string; numero: string };
  receiver: { tipo: string; numero: string } | null;
  signedXml: string;
};

/** Envía el comprobante firmado. Si no hay respuesta clara, lanza HaciendaFailure con notReceived = false. */
export async function sendDocument(input: SendInput): Promise<void> {
  const box: { cause?: string } = {};
  const http = await client(box);
  try {
    await submitDocument(http, {
      clave: input.clave,
      fecha: input.issuedAt,
      emisor: { tipoIdentificacion: input.emitter.tipo, numeroIdentificacion: input.emitter.numero },
      ...(input.receiver ? { receptor: { tipoIdentificacion: input.receiver.tipo, numeroIdentificacion: input.receiver.numero } } : {}),
      comprobanteXml: Buffer.from(input.signedXml, "utf8").toString("base64"),
    } as Parameters<typeof submitDocument>[1]);
  } catch (e) {
    const status = e instanceof ApiError ? e.statusCode : undefined;
    // 409: ya existe esa clave en Hacienda (lo recibió antes): se consulta el estado.
    if (status === 409) return;
    if (status === 400 || status === 401 || status === 403)
      throw new HaciendaFailure(`Hacienda no aceptó el envío${box.cause ? `: ${box.cause}` : ` (código ${status})`}.`, true);
    throw new HaciendaFailure("No hubo una respuesta clara de Hacienda. Consulta el estado en unos minutos antes de volver a enviar.", false);
  }
}

export type StatusResult =
  | { state: "recibido" | "procesando" | "aceptado" | "rechazado"; responseXml?: string; message?: string }
  | { state: "no_recibido"; message: string };

export async function queryStatus(clave: string): Promise<StatusResult> {
  const box: { cause?: string } = {};
  const http = await client(box);
  try {
    const s = await getStatus(http, clave);
    const state = s.status === "error" ? "rechazado" : s.status;
    const message = s.responseXml ? extractRejectionReason(s.responseXml) : undefined;
    return { state, responseXml: s.responseXml, message: state === "rechazado" ? (message ?? "Rechazado por Hacienda.") : undefined };
  } catch (e) {
    if (e instanceof ApiError && e.statusCode === 404) return { state: "no_recibido", message: "Hacienda no tiene ningún comprobante con esa clave." };
    throw new HaciendaFailure("No se pudo consultar el estado en Hacienda. Inténtalo más tarde.", false);
  }
}
