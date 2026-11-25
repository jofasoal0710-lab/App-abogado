/**
 * Validación de los datos de un cliente (alta y edición, y conversión de una solicitud): obligatorios,
 * identificación costarricense y fechas. Sin dependencias de servidor.
 */
import { z } from "zod";
import { ID_TYPES, MARITAL_STATUS, validateId, type IdType, type MaritalStatus } from "./cr-id";
import { todayISO } from "./dates";
import { optStr, str } from "./actions";
import { missingClientFields, nameLooksLikeId } from "./client-rules";
const clientSchema = z.object({
  type: z.enum(["persona", "empresa"]),
  name: z.string().min(2, "El nombre es obligatorio (mínimo 2 caracteres)").max(200),
  idType: z.enum(Object.keys(ID_TYPES) as [IdType, ...IdType[]]).nullable(),
  taxId: z.string().max(40).nullable(),
  birthDate: z.iso.date("La fecha de nacimiento no es válida").nullable(),
  maritalStatus: z.enum(Object.keys(MARITAL_STATUS) as [MaritalStatus, ...MaritalStatus[]]).nullable(),
  email: z.union([z.literal(null), z.email("El correo electrónico no es válido")]),
  phone: z.string().max(40).nullable(),
  address: z.string().max(500).nullable(),
  notes: z.string().max(5000).nullable(),
});


export function parseClient(formData: FormData) {
  const type = str(formData, "type");
  const persona = type === "persona";
  const parsed = clientSchema.safeParse({
    type,
    name: str(formData, "name"),
    idType: optStr(formData, "idType"),
    taxId: optStr(formData, "taxId"),
    // Fecha de nacimiento y estado civil solo tienen sentido en personas físicas.
    birthDate: persona ? optStr(formData, "birthDate") : null,
    maritalStatus: persona ? optStr(formData, "maritalStatus") : null,
    email: optStr(formData, "email"),
    phone: optStr(formData, "phone"),
    address: optStr(formData, "address"),
    notes: optStr(formData, "notes"),
  });
  // Todos los datos obligatorios a la vez, para que se vea qué falta (no solo el primero).
  const missing = missingClientFields({
    type: persona ? "persona" : "empresa",
    name: str(formData, "name"),
    taxId: optStr(formData, "taxId"),
    birthDate: persona ? optStr(formData, "birthDate") : null,
    maritalStatus: persona ? optStr(formData, "maritalStatus") : null,
    email: optStr(formData, "email"),
    phone: optStr(formData, "phone"),
    address: optStr(formData, "address"),
  });
  if (missing.length) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["form"], message: `Faltan datos obligatorios: ${missing.join(", ")}.`, input: null }]) };
  if (nameLooksLikeId(str(formData, "name"))) {
    return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["name"], message: "El nombre parece un número de identificación. Escribe el nombre en «Nombre completo» y la cédula en «Número de identificación».", input: null }]) };
  }
  if (!parsed.success) return parsed;
  const d = parsed.data;
  if (d.birthDate && d.birthDate > todayISO()) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["birthDate"], message: "La fecha de nacimiento no puede ser futura.", input: d.birthDate }]) };
  if (d.taxId) {
    const check = validateId(d.idType ?? "pasaporte", d.taxId);
    if (!check.ok) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["taxId"], message: check.error, input: d.taxId }]) };
    d.taxId = check.value;
  }
  if (!d.taxId) d.idType = null;
  return { success: true as const, data: d };
}

