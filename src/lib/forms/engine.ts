/**
 * Motor de formularios: cada formulario define sus campos y cómo se redacta el documento con ellos.
 * Puro (sin base de datos): se usa al generar, al corregir y al descargar.
 */
export type FieldType = "text" | "textarea" | "list" | "date";

/** Datos que se pueden rellenar solos a partir del expediente, el cliente y quien redacta. */
export type AutoKey =
  | "cliente.nombre"
  | "cliente.cedula"
  | "cliente.estadoCivil"
  | "cliente.domicilio"
  | "cliente.correo"
  | "expediente.juzgado"
  | "expediente.numero"
  | "expediente.contraparte"
  | "expediente.titulo"
  | "expediente.fundamentos"
  | "abogado.nombre"
  | "abogado.carne"
  | "abogado.correo"
  | "notario.nombre"
  | "notario.oficina"
  | "notario.numero"
  | "notario.tomo"
  | "notario.folio"
  | "fecha";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  auto?: AutoKey;
  hint?: string;
  required?: boolean;
};

/** Bloques del documento: títulos centrados, párrafos, listas numeradas (PRIMERO, SEGUNDO…) y firma. */
export type Block =
  | { t: "titulo"; text: string }
  | { t: "encabezado"; text: string }
  | { t: "p"; text: string }
  | { t: "seccion"; text: string }
  | { t: "ordinales"; items: string[] }
  | { t: "firma"; lines: string[] };

export type Values = Record<string, string>;

export type FormTemplate = {
  key: string;
  /** «escrito» = escritos de proceso del abogado; «escritura» = instrumentos notariales. */
  kind: "escrito" | "escritura";
  category: string;
  title: string;
  description: string;
  fields: Field[];
  render: (v: Values) => Block[];
};

export const BLANK = "________";

/** Valor de un campo, o una línea en blanco si falta (para completarlo a mano después). */
export function val(v: Values, name: string): string {
  const s = (v[name] ?? "").trim();
  return s || BLANK;
}

/** Texto multilínea → líneas no vacías (los hechos, las pretensiones…). */
export function lines(v: Values, name: string): string[] {
  return (v[name] ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)-]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

const ORDINALS = ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO"];
export function ordinal(i: number): string {
  return ORDINALS[i] ?? `${i + 1}.º`;
}

/** Fecha «AAAA-MM-DD» en letras de calendario: «19 de noviembre de 2026». */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim() || BLANK;
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  return `${Number(m[3])} de ${months[Number(m[2]) - 1]} de ${m[1]}`;
}

/** Texto plano del documento (para buscar, copiar o el registro). */
export function toPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.t === "ordinales") return b.items.map((it, i) => `${ordinal(i)}: ${it}`).join("\n");
      if (b.t === "firma") return b.lines.join("\n");
      return b.text;
    })
    .join("\n\n");
}

/** Valores iniciales: los que vienen guardados y, si no, los automáticos. */
export function initialValues(tpl: FormTemplate, auto: Partial<Record<AutoKey, string>>, saved?: Values): Values {
  const out: Values = {};
  for (const f of tpl.fields) out[f.name] = saved?.[f.name] ?? (f.auto ? (auto[f.auto] ?? "") : "");
  return out;
}

/** Limpia lo recibido del formulario: solo los campos del formulario, con un tamaño razonable. */
export function cleanValues(tpl: FormTemplate, raw: Record<string, unknown>): Values {
  const out: Values = {};
  for (const f of tpl.fields) {
    const v = raw[f.name];
    out[f.name] = typeof v === "string" ? v.slice(0, f.type === "text" || f.type === "date" ? 500 : 20000) : "";
  }
  return out;
}

export function missingRequired(tpl: FormTemplate, v: Values): string[] {
  return tpl.fields.filter((f) => f.required && !(v[f.name] ?? "").trim()).map((f) => f.label);
}
