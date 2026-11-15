/**
 * Regla de acceso a un expediente (pura, sin base de datos).
 * La versión SQL equivalente está en access.ts (matterAccessSql): deben decir siempre lo mismo.
 */
export type AccessUser = { id: number; role: "admin" | "abogado" | "asistente" };
export type AccessMatter = { visibility: "abierto" | "restringido"; responsibleId: number | null };

export const ACCESS_DENIED = "No tienes acceso a este expediente.";

/** ¿Puede este usuario ver el expediente y todo lo que cuelga de él? */
export function hasMatterAccess(user: AccessUser, matter: AccessMatter, memberIds: readonly number[]): boolean {
  if (user.role === "admin") return true;
  if (matter.visibility === "abierto") return true;
  return matter.responsibleId === user.id || memberIds.includes(user.id);
}

/** ¿Puede cambiar la visibilidad, el responsable y los miembros? Solo administradores y el responsable. */
export function canManageMatterAccess(user: AccessUser, matter: Pick<AccessMatter, "responsibleId">): boolean {
  return user.role === "admin" || matter.responsibleId === user.id;
}

/** Texto del historial de acceso. */
export function describeVisibility(v: AccessMatter["visibility"]): string {
  return v === "restringido" ? "restringido (solo responsable, miembros y administradores)" : "abierto (todo el equipo)";
}
