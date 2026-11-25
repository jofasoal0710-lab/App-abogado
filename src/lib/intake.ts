/**
 * Solicitudes de nuevos clientes (formulario público): validación de lo que envía la persona, límites de
 * los adjuntos y normalización de nombres para la búsqueda de conflictos. Lógica pura, sin base de datos.
 */
import { ID_TYPES, MARITAL_STATUS, validateId, type IdType } from "./cr-id";
import { extensionOf, sanitizeFilename } from "./file-types";

export const INTAKE_STATUSES = { pendiente: "Pendiente", aceptada: "Aceptada", descartada: "Descartada" } as const;
export type IntakeStatus = keyof typeof INTAKE_STATUSES;

export const INTAKE_AREAS = ["civil", "penal", "laboral", "mercantil", "familia", "administrativo", "fiscal", "inmobiliario", "otros"] as const;
export type IntakeArea = (typeof INTAKE_AREAS)[number];

export const CONTACT_OPTIONS = { telefono: "Llamada telefónica", whatsapp: "WhatsApp", correo: "Correo electrónico", presencial: "Cita en la oficina" } as const;

/** Adjuntos: pocos, pequeños y solo de tipos que no ejecutan nada al abrirse. */
export const INTAKE_MAX_FILES = 3;
export const INTAKE_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const INTAKE_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Cupos del formulario: por IP y en total (si alguien lo inunda, el despacho no recibe miles de solicitudes). */
export const INTAKE_PER_IP_PER_HOUR = 5;
export const INTAKE_GLOBAL_PER_HOUR = 40;
/** Tope de adjuntos de solicitudes en 24 horas (protege el almacenamiento frente a envíos masivos). */
export const INTAKE_DAILY_FILE_BYTES = 200 * 1024 * 1024;
/** Las descartadas se borran solas pasado este tiempo (minimización de datos, Ley 8968). */
export const INTAKE_DISCARDED_RETENTION_DAYS = 180;

export type IntakeInput = {
  clientType: "persona" | "empresa";
  name: string;
  idType: IdType | null;
  taxId: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  email: string;
  phone: string;
  address: string | null;
  area: IntakeArea;
  summary: string;
  opposingParty: string | null;
  deadline: string | null;
  preferredContact: string | null;
};

type Raw = Record<string, string | undefined>;
const clean = (v: string | undefined, max: number) => {
  // Sin caracteres de control (salvo saltos de línea en textos largos).
  // eslint-disable-next-line no-control-regex
  const t = (v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
  return t ? t.slice(0, max) : null;
};
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida el formulario público. Devuelve los datos limpios o la lista de errores (todos a la vez). */
export function parseIntake(raw: Raw, today: string): { ok: true; data: IntakeInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const clientType = raw.clientType === "empresa" ? "empresa" : "persona";
  const persona = clientType === "persona";
  const name = clean(raw.name, 200);
  if (!name || name.length < 3) errors.push(persona ? "Escribe tu nombre completo." : "Escribe la razón social de la empresa.");
  const email = clean(raw.email, 200);
  if (!email || !EMAIL.test(email)) errors.push("Escribe un correo electrónico válido.");
  const phone = clean(raw.phone, 40);
  if (!phone || phone.replace(/\D/g, "").length < 8) errors.push("Escribe un teléfono válido (al menos 8 dígitos).");
  const summary = clean(raw.summary, 5000);
  if (!summary || summary.length < 20) errors.push("Cuéntanos tu caso con un poco más de detalle (al menos 20 caracteres).");
  if (raw.consent !== "on") errors.push("Para enviar la solicitud debes aceptar el aviso de protección de datos.");

  let idType: IdType | null = raw.idType && raw.idType in ID_TYPES ? (raw.idType as IdType) : null;
  let taxId = clean(raw.taxId, 40);
  if (taxId) {
    const check = validateId(idType ?? (persona ? "cedula_fisica" : "cedula_juridica"), taxId);
    if (!check.ok) errors.push(check.error);
    else {
      taxId = check.value;
      idType = idType ?? (persona ? "cedula_fisica" : "cedula_juridica");
    }
  } else idType = null;

  const birthDate = persona ? clean(raw.birthDate, 10) : null;
  if (birthDate && (!ISO.test(birthDate) || birthDate > today || birthDate < "1900-01-01")) errors.push("La fecha de nacimiento no es válida.");
  const maritalStatus = persona && raw.maritalStatus && raw.maritalStatus in MARITAL_STATUS ? raw.maritalStatus : null;
  const deadline = clean(raw.deadline, 10);
  if (deadline && (!ISO.test(deadline) || deadline < "2000-01-01")) errors.push("La fecha límite no es válida.");
  const area = (INTAKE_AREAS as readonly string[]).includes(raw.area ?? "") ? (raw.area as IntakeArea) : "otros";
  const preferredContact = raw.preferredContact && raw.preferredContact in CONTACT_OPTIONS ? raw.preferredContact : null;

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      clientType,
      name: name!,
      idType,
      taxId,
      birthDate,
      maritalStatus,
      email: email!.toLowerCase(),
      phone: phone!,
      address: clean(raw.address, 500),
      area,
      summary: summary!,
      opposingParty: clean(raw.opposingParty, 250),
      deadline,
      preferredContact,
    },
  };
}

/** Comprueba un adjunto: tipo por la extensión (nunca el que dice el navegador) y tamaño. */
export function checkIntakeFile(name: string, size: number): { ok: true; name: string; mimeType: string } | { ok: false; error: string } {
  const safe = sanitizeFilename(name);
  const mimeType = INTAKE_FILE_TYPES[extensionOf(safe)];
  if (!mimeType) return { ok: false, error: `«${safe}»: solo se admiten PDF, fotos (JPG, PNG, WEBP) y Word (.docx).` };
  if (size > INTAKE_MAX_FILE_BYTES) return { ok: false, error: `«${safe}» supera los ${INTAKE_MAX_FILE_BYTES / 1024 / 1024} MB.` };
  if (size === 0) return { ok: false, error: `«${safe}» está vacío.` };
  return { ok: true, name: safe, mimeType };
}

/**
 * ¿El contenido es del tipo que dice la extensión? (Evita, p. ej., un HTML renombrado a .pdf.) Se miran los
 * primeros bytes del fichero.
 */
export function magicMatches(mimeType: string, head: Uint8Array): boolean {
  const starts = (...b: number[]) => b.every((x, i) => head[i] === x);
  switch (mimeType) {
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
    default:
      return starts(0x50, 0x4b, 0x03, 0x04); // .docx = zip
  }
}

/** «José  Pérez-Mora» → «jose perez mora»: minúsculas, sin tildes ni signos, espacios simples. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

const STOP = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "sa", "s", "a", "srl", "ltda", "limitada", "sociedad", "anonima", "cia", "compania", "inc", "corp"]);

/** Palabras significativas de un nombre para buscar coincidencias (sin «de», «S.A.», etc.). */
export function nameTokens(s: string): string[] {
  return [...new Set(normalizeName(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, 6);
}

/**
 * ¿Dos nombres se refieren probablemente a la misma persona? Coinciden si todas las palabras del más corto
 * están en el otro (así «Ana Mora» encuentra «Ana Lucía Mora Vargas»), con al menos dos palabras o una
 * única palabra larga (nombres de empresa como «Inversiones»).
 */
export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  if (short.length === 1 && short[0].length < 6) return false;
  return short.every((w) => long.has(w));
}
