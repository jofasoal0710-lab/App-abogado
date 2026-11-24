import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, matters, users } from "@/db/schema";
import type { Client, Matter } from "@/db/schema";
import type { CurrentUser } from "./auth";
import { config } from "./config";
import { ID_TYPES, MARITAL_STATUS } from "./cr-id";
import { todayISO } from "./dates";
import { areaLabels } from "./labels";
import { longDate, shortDate } from "./word-templates";

const pick = <T extends Record<string, string>>(map: T, k: string | null | undefined) => (k && k in map ? map[k as keyof T] : (k ?? ""));

/** Valores de los campos automáticos para un expediente (el usuario los puede corregir antes de generar). */
export function autoFieldValues(user: CurrentUser & { barNumber?: string | null }, matter: Matter, client: Client): Record<string, string> {
  const today = todayISO();
  return {
    cliente: client.name,
    cliente_tipo_id: pick(ID_TYPES, client.idType),
    cliente_cedula: client.taxId ?? "",
    cliente_estado_civil: pick(MARITAL_STATUS, client.maritalStatus).toLowerCase(),
    cliente_fecha_nacimiento: client.birthDate ? longDate(client.birthDate) : "",
    cliente_direccion: client.address ?? "",
    cliente_correo: client.email ?? "",
    cliente_telefono: client.phone ?? "",
    expediente: matter.number,
    expediente_titulo: matter.title,
    materia: pick(areaLabels, matter.area),
    juzgado: matter.court ?? "",
    expediente_judicial: matter.courtCaseNumber ?? "",
    parte_contraria: matter.opposingParty ?? "",
    abogado: user.name,
    abogado_carne: user.barNumber ?? "",
    abogado_correo: user.email,
    despacho: config.firmName,
    despacho_cedula: config.firmTaxId,
    despacho_direccion: config.firmAddress,
    fecha: longDate(today),
    fecha_corta: shortDate(today),
  };
}

/** Expediente + cliente para rellenar (quien llama ya comprobó el acceso al expediente). */
export async function loadFillContext(matterId: number) {
  const [row] = await db.select({ client: clients, matter: matters }).from(matters).innerJoin(clients, eq(clients.id, matters.clientId)).where(eq(matters.id, matterId));
  return row ?? null;
}

export async function loadBarNumber(userId: number) {
  const [u] = await db.select({ barNumber: users.barNumber }).from(users).where(eq(users.id, userId));
  return u?.barNumber ?? null;
}
