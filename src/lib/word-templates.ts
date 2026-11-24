/**
 * Plantillas Word propias: detección de campos y rellenado de un .docx (docxtemplater).
 *
 * Los campos se escriben en Word entre llaves: {cliente}, {cliente_cedula}, {expediente}… Solo se admiten
 * nombres simples (letras, números y guion bajo): nada de expresiones, así que una plantilla no puede
 * ejecutar código. Los valores se escapan como texto XML al insertarse.
 */
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export const FIELD_NAME = /^[a-z0-9_áéíóúñü]{1,60}$/;

export type FieldDef = { key: string; label: string; group: string };

/** Campos que la app rellena sola a partir del expediente, su cliente, la persona y el despacho. */
export const AUTO_FIELDS: readonly FieldDef[] = [
  { key: "cliente", label: "Nombre del cliente", group: "Cliente" },
  { key: "cliente_tipo_id", label: "Tipo de identificación", group: "Cliente" },
  { key: "cliente_cedula", label: "Cédula o identificación", group: "Cliente" },
  { key: "cliente_estado_civil", label: "Estado civil", group: "Cliente" },
  { key: "cliente_fecha_nacimiento", label: "Fecha de nacimiento", group: "Cliente" },
  { key: "cliente_direccion", label: "Dirección", group: "Cliente" },
  { key: "cliente_correo", label: "Correo electrónico", group: "Cliente" },
  { key: "cliente_telefono", label: "Teléfono", group: "Cliente" },
  { key: "expediente", label: "Número del expediente", group: "Expediente" },
  { key: "expediente_titulo", label: "Título del asunto", group: "Expediente" },
  { key: "materia", label: "Materia", group: "Expediente" },
  { key: "juzgado", label: "Juzgado o tribunal", group: "Expediente" },
  { key: "expediente_judicial", label: "N.º de expediente judicial", group: "Expediente" },
  { key: "parte_contraria", label: "Parte contraria", group: "Expediente" },
  { key: "abogado", label: "Nombre de quien genera el documento", group: "Abogado/a" },
  { key: "abogado_carne", label: "Carné del Colegio de Abogados", group: "Abogado/a" },
  { key: "abogado_correo", label: "Correo de quien genera", group: "Abogado/a" },
  { key: "despacho", label: "Nombre del despacho", group: "Despacho" },
  { key: "despacho_cedula", label: "Cédula jurídica del despacho", group: "Despacho" },
  { key: "despacho_direccion", label: "Dirección del despacho", group: "Despacho" },
  { key: "fecha", label: "Fecha de hoy, en letras («24 de noviembre de 2026»)", group: "Fecha" },
  { key: "fecha_corta", label: "Fecha de hoy («24/11/2026»)", group: "Fecha" },
];
export const AUTO_KEYS = new Set(AUTO_FIELDS.map((f) => f.key));

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
/** «2026-11-24» → «24 de noviembre de 2026» (en Costa Rica, «setiembre»). */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}
export const shortDate = (iso: string) => iso.split("-").reverse().join("/");

/** Límites del .docx: tamaño, número de piezas y tamaño descomprimido (evita «bombas zip»). */
export const MAX_TEMPLATE_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_UNCOMPRESSED = 40 * 1024 * 1024;

export class TemplateError extends Error {}

function openDocx(buf: Buffer): PizZip {
  if (buf.length > MAX_TEMPLATE_BYTES) throw new TemplateError("La plantilla supera los 5 MB.");
  let zip: PizZip;
  try {
    zip = new PizZip(buf);
  } catch {
    throw new TemplateError("El archivo no es un documento de Word (.docx) válido.");
  }
  const files = Object.values(zip.files);
  if (files.length > MAX_ENTRIES) throw new TemplateError("El documento tiene demasiadas partes.");
  const total = files.reduce((s, f) => s + ((f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
  if (total > MAX_UNCOMPRESSED) throw new TemplateError("El documento es demasiado grande una vez descomprimido.");
  if (!zip.file("word/document.xml") || !zip.file("[Content_Types].xml")) throw new TemplateError("El archivo no es un documento de Word (.docx) válido.");
  if (zip.file(/vbaProject\.bin$/i).length) throw new TemplateError("El documento contiene macros: guárdalo como .docx normal (sin macros).");
  return zip;
}

/** Mensaje claro a partir de los errores de docxtemplater (llaves sin cerrar, campos con espacios…). */
function explain(err: unknown): string {
  type Props = { explanation?: string; xtag?: string; id?: string; rootError?: unknown };
  const e = err as { properties?: Props & { errors?: { properties?: Props }[] } };
  const list = e.properties?.errors ?? [];
  // Nuestros propios mensajes (campo no válido) llegan envueltos por docxtemplater.
  const root = [e.properties?.rootError, ...list.map((x) => x.properties?.rootError)].find((r) => r instanceof TemplateError);
  if (root) return (root as TemplateError).message;
  if (list.length) {
    const first = list[0].properties ?? {};
    const tag = first.xtag ? ` («{${first.xtag}}»)` : "";
    if (first.id === "unclosed_tag" || first.id === "unopened_tag") return `Hay una llave sin cerrar o sin abrir${tag}. Revisa que cada campo esté escrito como {nombre}.`;
    return `La plantilla tiene un error${tag}: ${first.explanation ?? "revisa las llaves de los campos"}.`;
  }
  return err instanceof Error ? err.message : "No se pudo leer la plantilla.";
}

function compile(zip: PizZip, seen: string[], values?: Record<string, string>) {
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Solo nombres simples: el «parser» decide qué es un campo y devuelve su valor (nunca evalúa nada).
    parser: (tag: string) => {
      const key = tag.trim().toLowerCase();
      if (!FIELD_NAME.test(key)) throw new TemplateError(`El campo «{${tag}}» no es válido: usa solo letras, números y guion bajo (p. ej. {fecha_audiencia}).`);
      if (!seen.includes(key)) seen.push(key);
      return { get: () => values?.[key] ?? "" };
    },
    nullGetter: () => "",
  });
}

/** Comprueba que la plantilla se puede usar y devuelve sus campos en orden de aparición. */
export function inspectTemplate(buf: Buffer): string[] {
  const zip = openDocx(buf);
  const seen: string[] = [];
  try {
    compile(zip, seen);
  } catch (err) {
    if (err instanceof TemplateError) throw err;
    throw new TemplateError(explain(err));
  }
  return seen;
}

/** Genera el .docx con los valores (los campos que falten quedan vacíos). */
export function renderTemplate(buf: Buffer, values: Record<string, string>): Buffer {
  const zip = openDocx(buf);
  const doc = compile(zip, [], values);
  try {
    doc.render();
  } catch (err) {
    if (err instanceof TemplateError) throw err;
    throw new TemplateError(explain(err));
  }
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** «Contestación de demanda - EXP-2026-0001.docx», sin caracteres que den problemas en nombres de fichero. */
export function outputName(templateName: string, matterNumber: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${clean(templateName)} - ${clean(matterNumber)}.docx`;
}
