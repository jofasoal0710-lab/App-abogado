/**
 * Datos obligatorios de un cliente (puro, sin dependencias de servidor: lo usan la acción y los tests).
 * Persona física: nombre, identificación, fecha de nacimiento, estado civil, correo, teléfono y dirección.
 * Persona jurídica: lo mismo salvo fecha de nacimiento y estado civil. Las notas son opcionales.
 */
export type ClientInput = {
  type: "persona" | "empresa";
  name: string | null;
  taxId: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function missingClientFields(c: ClientInput): string[] {
  const empty = (v: string | null) => !v || !v.trim();
  const out: string[] = [];
  if (empty(c.name)) out.push(c.type === "empresa" ? "Razón social" : "Nombre completo");
  if (empty(c.taxId)) out.push("Número de identificación");
  if (c.type === "persona") {
    if (empty(c.birthDate)) out.push("Fecha de nacimiento");
    if (empty(c.maritalStatus)) out.push("Estado civil");
  }
  if (empty(c.email)) out.push("Correo electrónico");
  if (empty(c.phone)) out.push("Teléfono");
  if (empty(c.address)) out.push("Dirección");
  return out;
}

/** ¿El «nombre» es en realidad un número (p. ej. la cédula escrita en el campo equivocado)? */
export function nameLooksLikeId(name: string): boolean {
  return /^[\d\s.\-]+$/.test(name.trim()) && /\d{4,}/.test(name.replace(/\D/g, ""));
}
