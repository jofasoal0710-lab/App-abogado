"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { firstZodError, str, type ActionState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth";
import { normalizePermissions, PERMISSIONS, type Permission } from "@/lib/permissions";
import { countOtherActiveManagers, getRole, roleManagesTeam } from "@/lib/roles";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";
import { asSessionActor, asActor } from "@/lib/data-audit";

const roleSchema = z.object({
  name: z.string().trim().min(2, "El nombre del rol es obligatorio").max(60, "El nombre del rol es demasiado largo"),
  description: z.string().trim().max(200, "La descripción es demasiado larga"),
});

function parseRole(formData: FormData) {
  const parsed = roleSchema.safeParse({ name: str(formData, "name"), description: str(formData, "description") });
  const permissions = normalizePermissions(formData.getAll("permissions").map(String));
  return { parsed, permissions };
}

async function nameTaken(name: string, exceptId?: number) {
  const rows = await db.select({ id: roles.id, name: roles.name }).from(roles);
  return rows.some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());
}

const labelOf = (p: Permission) => PERMISSIONS[p].label;

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("equipo.gestionar");
  const { parsed, permissions } = parseRole(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  if (await nameTaken(parsed.data.name)) return { error: "Ya existe un rol con ese nombre." };

  await db.insert(roles).values({ name: parsed.data.name, description: parsed.data.description || null, permissions });
  const { ip } = await requestMeta();
  await logSecurityEvent("rol_creado", {
    actorId: actor.id,
    ip,
    detail: `${parsed.data.name}: ${permissions.length ? permissions.map(labelOf).join(", ") : "sin permisos especiales"}`,
  });
  revalidatePath("/equipo");
  return { ok: `Rol «${parsed.data.name}» creado. Ya puedes asignarlo a las personas del equipo.` };
}

export async function updateRoleAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("equipo.gestionar");
  const role = await getRole(id);
  if (!role) return { error: "Ese rol no existe." };
  // El administrador del sistema siempre lo puede todo: así nunca se pierde el control de la aplicación.
  if (role.systemKey === "admin") return { error: "El rol Administrador no se puede modificar." };

  const { parsed, permissions } = parseRole(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  if (await nameTaken(parsed.data.name, id)) return { error: "Ya existe otro rol con ese nombre." };

  // Quitar «gestionar el equipo» a un rol no puede dejar la aplicación sin gestores, ni bloquear a quien lo hace.
  const before = normalizePermissions(role.permissions);
  if (roleManagesTeam(role) && !permissions.includes("equipo.gestionar")) {
    if (actor.roleId === id) return { error: "No puedes quitar a tu propio rol el permiso de gestionar el equipo." };
    if ((await countOtherActiveManagers({ exceptRoleId: id })) === 0) {
      return { error: "Debe quedar al menos una persona activa que pueda gestionar el equipo con otro rol." };
    }
  }

  await asSessionActor((tx) => tx.update(roles).set({ name: parsed.data.name, description: parsed.data.description || null, permissions }).where(eq(roles.id, id)));

  const added = permissions.filter((p) => !before.includes(p)).map(labelOf);
  const removed = before.filter((p) => !permissions.includes(p)).map(labelOf);
  const changes = [
    role.name !== parsed.data.name ? `nombre: ${role.name} → ${parsed.data.name}` : null,
    added.length ? `añadidos: ${added.join(", ")}` : null,
    removed.length ? `quitados: ${removed.join(", ")}` : null,
  ].filter(Boolean);
  if (changes.length) {
    const { ip } = await requestMeta();
    await logSecurityEvent("rol_modificado", { actorId: actor.id, ip, detail: `${parsed.data.name} — ${changes.join("; ")}` });
  }
  revalidatePath("/", "layout");
  return { ok: changes.length ? "Rol guardado. Los cambios se aplican al instante a todas las personas con este rol." : "Sin cambios." };
}

export async function deleteRoleAction(id: number, _prev: ActionState): Promise<ActionState> {
  const actor = await requirePermission("equipo.gestionar");
  const role = await getRole(id);
  if (!role) return { error: "Ese rol no existe." };
  if (role.systemKey) return { error: "Los roles de sistema no se pueden eliminar (sí puedes cambiar sus permisos, salvo los del Administrador)." };
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.roleId, id));
  if (n > 0) return { error: `No se puede eliminar: lo tienen asignado ${n} persona(s). Cámbiales antes el rol.` };

  await asActor(actor.id, (tx) => tx.delete(roles).where(eq(roles.id, id)));
  const { ip } = await requestMeta();
  await logSecurityEvent("rol_eliminado", { actorId: actor.id, ip, detail: role.name });
  revalidatePath("/equipo");
  return { ok: `Rol «${role.name}» eliminado.` };
}
