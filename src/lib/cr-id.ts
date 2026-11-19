/**
 * Identificaciones de Costa Rica (formato del Ministerio de Hacienda para comprobantes electrónicos):
 *  - Cédula física: 9 dígitos (p. ej. 1-1234-5678 → 112345678). Hacienda la escribe con 9 dígitos.
 *  - Cédula jurídica: 10 dígitos, empieza por 3 (3-101-123456).
 *  - DIMEX (residentes extranjeros): 11 o 12 dígitos.
 *  - NITE (número de identificación tributaria especial): 10 dígitos.
 *  - Pasaporte u otra: texto libre (no se valida ni se consulta en Hacienda).
 */
export const ID_TYPES = {
  cedula_fisica: "Cédula física",
  cedula_juridica: "Cédula jurídica",
  dimex: "DIMEX (residente)",
  nite: "NITE",
  pasaporte: "Pasaporte u otra",
} as const;
export type IdType = keyof typeof ID_TYPES;

export const MARITAL_STATUS = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  union_hecho: "Unión de hecho",
  separado: "Separado/a",
  divorciado: "Divorciado/a",
  viudo: "Viudo/a",
} as const;
export type MaritalStatus = keyof typeof MARITAL_STATUS;

/** Solo los dígitos (quita guiones y espacios): «1-1234-0567» → «112340567». */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Comprueba el número según su tipo. Devuelve el número normalizado (solo dígitos, salvo pasaporte) o un
 * mensaje de error en castellano.
 */
export function validateId(type: IdType, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (type === "pasaporte") return value.length <= 40 ? { ok: true, value } : { ok: false, error: "La identificación es demasiado larga." };
  const d = onlyDigits(value);
  switch (type) {
    case "cedula_fisica":
      return /^[1-9]\d{8}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "La cédula física tiene 9 dígitos (p. ej. 1-1234-0567), sin empezar por 0." };
    case "cedula_juridica":
      return /^3\d{9}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "La cédula jurídica tiene 10 dígitos y empieza por 3 (p. ej. 3-101-123456)." };
    case "dimex":
      return /^[1-9]\d{10,11}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "El DIMEX tiene 11 o 12 dígitos, sin empezar por 0." };
    case "nite":
      return /^\d{10}$/.test(d) ? { ok: true, value: d } : { ok: false, error: "El NITE tiene 10 dígitos." };
  }
}

/** Forma legible: 1-1234-0567 y 3-101-123456; el resto, tal cual. */
export function formatId(type: string | null, value: string | null): string {
  if (!value) return "";
  if (type === "cedula_fisica" && /^\d{9}$/.test(value)) return `${value[0]}-${value.slice(1, 5)}-${value.slice(5)}`;
  if (type === "cedula_juridica" && /^\d{10}$/.test(value)) return `${value[0]}-${value.slice(1, 4)}-${value.slice(4)}`;
  return value;
}

/** Tipo de identificación más probable a partir del número (para proponerlo en el formulario). */
export function guessIdType(raw: string): IdType | null {
  const d = onlyDigits(raw);
  if (/^[1-9]\d{8}$/.test(d)) return "cedula_fisica";
  if (/^3\d{9}$/.test(d)) return "cedula_juridica";
  if (/^[1-9]\d{10,11}$/.test(d)) return "dimex";
  return null;
}

/** Edad cumplida en `today` (fechas «AAAA-MM-DD»). null si la fecha no es válida o es futura. */
export function ageOn(birthDate: string, today: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !t) return null;
  const [by, bm, bd] = b.slice(1).map(Number);
  const [ty, tm, td] = t.slice(1).map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 && age < 150 ? age : null;
}
