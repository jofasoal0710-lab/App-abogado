/**
 * Reglas de acceso (puras, sin base de datos).
 * Las versiones SQL equivalentes están en access.ts (matterAccessSql / clientAccessSql): deben decir siempre lo mismo.
 */
import { can, type PermissionHolder } from "./permissions";

export type AccessUser = { id: number } & PermissionHolder;
export type MatterVisibility = "abierto" | "restringido" | "confidencial";
export type ClientVisibility = "abierto" | "confidencial";
export type AccessMatter = { visibility: MatterVisibility; responsibleId: number | null };

export const ACCESS_DENIED = "No tienes acceso a este expediente.";
export const CLIENT_ACCESS_DENIED = "No tienes acceso a este cliente.";

/**
 * ¿Puede este usuario ver el expediente y todo lo que cuelga de él?
 *  - abierto: todo el mundo.
 *  - restringido: responsable, miembros y quien tenga el permiso «ver restringidos».
 *  - confidencial: solo responsable y miembros (ningún permiso da atajo).
 */
export function hasMatterAccess(user: AccessUser, matter: AccessMatter, memberIds: readonly number[]): boolean {
  if (matter.visibility === "abierto") return true;
  if (matter.visibility === "restringido" && can(user, "expedientes.ver_restringidos")) return true;
  return matter.responsibleId === user.id || memberIds.includes(user.id);
}

/**
 * ¿Puede cambiar la visibilidad, el responsable y los miembros? El responsable, o quien tenga el
 * permiso «gestionar el acceso de cualquier expediente». Se evalúa siempre DESPUÉS de comprobar el
 * acceso: sin acceso a un expediente confidencial ni siquiera se llega a esta pregunta.
 */
export function canManageMatterAccess(user: AccessUser, matter: Pick<AccessMatter, "responsibleId">): boolean {
  return can(user, "expedientes.gestionar_acceso") || matter.responsibleId === user.id;
}

/**
 * ¿Ve el cliente? Si es abierto, todos. Si es confidencial: quien lo dio de alta o quien tenga
 * acceso a alguno de sus expedientes. Los administradores no tienen atajo.
 */
export function hasClientAccess(
  user: Pick<AccessUser, "id">,
  client: { visibility: ClientVisibility; createdById: number | null },
  hasAccessibleMatter: boolean,
): boolean {
  return client.visibility === "abierto" || client.createdById === user.id || hasAccessibleMatter;
}

/** Los expedientes de un cliente confidencial nunca pueden ser abiertos. */
export function minimumMatterVisibility(client: { visibility: ClientVisibility }, requested: MatterVisibility): MatterVisibility {
  return client.visibility === "confidencial" && requested === "abierto" ? "restringido" : requested;
}

/** Personas activas que conservan el expediente por derecho propio (responsable y miembros). */
export function activeHolderIds(
  responsible: { id: number; active: boolean } | null,
  members: readonly { id: number; active: boolean }[],
): number[] {
  const ids = new Set<number>();
  if (responsible?.active) ids.add(responsible.id);
  for (const m of members) if (m.active) ids.add(m.id);
  return [...ids];
}

/** Quién, de entre los candidatos, NO puede ver el expediente (para reasignar sus eventos). */
export function usersWithoutAccess<T extends AccessUser>(
  matter: AccessMatter,
  memberIds: readonly number[],
  candidates: readonly T[],
): T[] {
  return candidates.filter((u) => !hasMatterAccess(u, matter, memberIds));
}

export const VISIBILITY_LABELS: Record<MatterVisibility, string> = {
  abierto: "Abierto",
  restringido: "Restringido",
  confidencial: "Confidencial",
};

/** Texto del historial de acceso. */
export function describeVisibility(v: MatterVisibility): string {
  if (v === "confidencial") return "confidencial (solo responsable y miembros; ni los administradores)";
  if (v === "restringido") return "restringido (solo responsable, miembros y quien pueda ver los restringidos)";
  return "abierto (todo el equipo)";
}
