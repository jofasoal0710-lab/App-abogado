import "server-only";
import { and, asc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, matterCitations, matters, users, writings } from "@/db/schema";
import { legalBasis } from "./normativa";
import { getAccessibleMatter, matterAccessSql } from "./access";
import type { CurrentUser } from "./auth";
import { formatId, MARITAL_STATUS, type MaritalStatus } from "./cr-id";
import { todayISO } from "./dates";
import type { AutoKey } from "./forms/engine";
import { getNotaryProfile, nextDeedNumber } from "./notary";

/**
 * Quién ve un escrito: si es de un expediente, quien ve el expediente (mismas reglas, también las de los
 * confidenciales); si no tiene expediente (p. ej. una escritura suelta), solo quien lo redactó.
 */
export function writingAccessSql(user: CurrentUser): SQL {
  return or(
    and(isNotNull(writings.matterId), matterAccessSql(user, writings.matterId)),
    and(isNull(writings.matterId), eq(writings.createdById, user.id)),
  )!;
}

export async function getAccessibleWriting(user: CurrentUser, id: number) {
  const [w] = await db.select().from(writings).where(and(eq(writings.id, id), writingAccessSql(user))).limit(1);
  return w ?? null;
}

/** Datos para rellenar solos los campos: del expediente, de su cliente y de quien redacta. */
export async function autoValues(user: CurrentUser, matterId: number | null): Promise<Partial<Record<AutoKey, string>>> {
  const [me] = await db.select({ barNumber: users.barNumber }).from(users).where(eq(users.id, user.id));
  const out: Partial<Record<AutoKey, string>> = {
    "abogado.nombre": user.name,
    "abogado.correo": user.email,
    "abogado.carne": me?.barNumber ?? "",
    fecha: todayISO(),
  };
  const notary = await getNotaryProfile(user.id);
  if (notary) {
    Object.assign(out, {
      "notario.nombre": notary.fullName,
      "notario.oficina": notary.office ?? "",
      "notario.numero": String(await nextDeedNumber(user.id)),
      "notario.tomo": notary.currentVolume ?? "",
      "notario.folio": String(notary.nextFolio),
    });
  } else {
    out["notario.nombre"] = user.name;
  }
  if (matterId === null) return out;
  const matter = await getAccessibleMatter(user, matterId);
  if (!matter) return out;
  const [c] = await db.select().from(clients).where(eq(clients.id, matter.clientId));
  Object.assign(out, {
    "expediente.juzgado": matter.court ?? "",
    "expediente.numero": matter.courtCaseNumber ?? "",
    "expediente.contraparte": matter.opposingParty ?? "",
    "expediente.titulo": matter.title,
    "expediente.fundamentos": legalBasis(await db.select().from(matterCitations).where(eq(matterCitations.matterId, matter.id)).orderBy(asc(matterCitations.id))),
    "cliente.nombre": c?.name ?? "",
    "cliente.cedula": c ? formatId(c.idType, c.taxId) : "",
    "cliente.estadoCivil": c?.maritalStatus ? MARITAL_STATUS[c.maritalStatus as MaritalStatus]?.toLowerCase() ?? "" : "",
    "cliente.domicilio": c?.address ?? "",
    "cliente.correo": c?.email ?? "",
  });
  return out;
}

/** Escritos de un expediente (para su pestaña). */
export function listMatterWritings(matterId: number) {
  return db
    .select({ id: writings.id, title: writings.title, kind: writings.kind, updatedAt: writings.updatedAt, author: users.name })
    .from(writings)
    .leftJoin(users, eq(users.id, writings.createdById))
    .where(eq(writings.matterId, matterId))
    .orderBy(sql`${writings.updatedAt} desc`);
}

export { matters };
