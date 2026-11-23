"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { firstZodError, str, type ActionState } from "@/lib/actions";
import { countSoleHolderConfidential } from "@/lib/access";
import { notifyPasswordChanged } from "@/lib/account-mail";
import { requirePermission } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/passwords";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";
import { revokeSessions } from "@/lib/session";
import { countOtherActiveManagers, getRole, roleManagesTeam } from "@/lib/roles";
import { asSessionActor } from "@/lib/data-audit";

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX);

const baseSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(150),
  email: z.email("El correo electrónico no es válido").max(200),
  roleId: z.number({ error: "Elige un rol" }).int().positive("Elige un rol"),
  hourlyRateCents: z.number({ error: "La tarifa por hora no es válida" }).int().nonnegative(),
  barNumber: z.string().max(40).nullable(),
});

function parseBase(formData: FormData) {
  const rateRaw = str(formData, "hourlyRate");
  const rate = rateRaw === "" ? 0 : parseMoneyToCents(rateRaw);
  return baseSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    roleId: Number(str(formData, "roleId")) || undefined,
    hourlyRateCents: rate ?? undefined,
    barNumber: str(formData, "barNumber") || null,
  });
}

async function emailTaken(email: string, exceptId?: number) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, exceptId ? ne(users.id, exceptId) : undefined))
    .limit(1);
  return !!row;
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("equipo.gestionar");
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return { error: firstZodError(password.error) };
  if (await emailTaken(parsed.data.email)) return { error: "Ya existe un usuario con ese correo." };
  const role = await getRole(parsed.data.roleId);
  if (!role) return { error: "Ese rol no existe." };

  const [created] = await db
    .insert(users)
    .values({
      ...parsed.data,
      emailReminders: formData.get("emailReminders") === "on",
      passwordHash: await bcrypt.hash(password.data, 12),
      // Es una contraseña provisional: al entrar por primera vez tendrá que elegir la suya.
      mustChangePassword: true,
      passwordChangedAt: new Date(), // la provisional caduca a los PROVISIONAL_PASSWORD_DAYS días
    })
    .returning({ id: users.id });
  const { ip } = await requestMeta();
  await logSecurityEvent("usuario_creado", {
    actorId: admin.id,
    targetId: created.id,
    email: parsed.data.email,
    ip,
    detail: `Rol: ${role.name}`,
  });
  revalidatePath("/equipo");
  return { ok: `Usuario ${parsed.data.name} creado. Al entrar por primera vez tendrá que elegir su propia contraseña.` };
}

export async function updateUserAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("equipo.gestionar");
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const active = formData.get("active") === "on";
  const newPassword = String(formData.get("password") ?? "");

  // Cada uno cambia su contraseña en «Mi cuenta» (pidiendo la actual), también los administradores.
  if (newPassword && id === admin.id) return { error: "Para cambiar tu propia contraseña usa «Mi cuenta»." };
  if (await emailTaken(parsed.data.email, id)) return { error: "Ya existe otro usuario con ese correo." };
  const [before] = await db
    .select({ name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name, active: users.active })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, id));
  if (!before) return { error: "Ese usuario no existe." };
  const newRole = await getRole(parsed.data.roleId);
  if (!newRole) return { error: "Ese rol no existe." };

  // Nunca puede quedarse la aplicación sin nadie que gestione el equipo (ni auto-bloquearse).
  const keepsManaging = active && roleManagesTeam(newRole);
  if (!keepsManaging) {
    if (id === admin.id) return { error: "No puedes quitarte a ti mismo el permiso de gestionar el equipo ni desactivarte." };
    if ((await countOtherActiveManagers({ exceptUserId: id })) === 0) {
      return { error: "Debe quedar al menos una persona activa que pueda gestionar el equipo." };
    }
  }

  // No se puede desactivar a la única persona con acceso a un expediente confidencial: quedaría huérfano.
  if (!active) {
    const n = await countSoleHolderConfidential(id);
    if (n > 0) {
      return { error: `No se puede desactivar: es la única persona activa con acceso a ${n} expediente(s) confidencial(es). Que su responsable añada antes a otra persona.` };
    }
  }

  const set: Partial<typeof users.$inferInsert> = {
    ...parsed.data,
    active,
    emailReminders: formData.get("emailReminders") === "on",
  };
  if (newPassword) {
    const pw = passwordSchema.safeParse(newPassword);
    if (!pw.success) return { error: firstZodError(pw.error) };
    set.passwordHash = await bcrypt.hash(pw.data, 12);
    // Contraseña provisional: el administrador la conoce, así que el titular deberá cambiarla al entrar.
    set.mustChangePassword = true;
    set.passwordChangedAt = new Date();
  }

  await asSessionActor((tx) => tx.update(users).set(set).where(eq(users.id, id)));

  // Efectos de seguridad y registro de cada cambio sensible.
  const { ip } = await requestMeta();
  const base = { actorId: admin.id, targetId: id, email: parsed.data.email, ip };
  const notes: string[] = [];
  if (newPassword) {
    const closed = await revokeSessions(id);
    await logSecurityEvent("contrasena_restablecida", { ...base, detail: closed ? `Se cerraron ${closed} sesión(es) abiertas` : null });
    // Aviso a la dirección ANTERIOR: si a la vez se cambió el correo, el titular legítimo se entera igual.
    const sent = await notifyPasswordChanged({ name: before.name, email: before.email }, { name: admin.name });
    notes.push(`deberá elegir una contraseña nueva al entrar${closed ? ` (se cerraron ${closed} sesión(es))` : ""}${sent ? "; se le ha avisado por correo" : ""}`);
  }
  if (before.roleId !== parsed.data.roleId) {
    await logSecurityEvent("rol_cambiado", { ...base, detail: `${before.roleName} → ${newRole.name}` });
  }
  if (before.email.toLowerCase() !== parsed.data.email) {
    await logSecurityEvent("correo_cambiado", { ...base, detail: `${before.email} → ${parsed.data.email}` });
  }
  if (before.active && !active) {
    const closed = await revokeSessions(id);
    await logSecurityEvent("usuario_desactivado", { ...base, detail: closed ? `Se cerraron ${closed} sesión(es) abiertas` : null });
  } else if (!before.active && active) {
    await logSecurityEvent("usuario_reactivado", base);
  }

  revalidatePath("/equipo");
  return { ok: notes.length ? `Cambios guardados: ${notes.join("; ")}.` : "Cambios guardados." };
}

/** Cierra todas las sesiones abiertas de una persona (p. ej. si ha perdido el portátil). */
export async function revokeUserSessionsAction(id: number, _prev: ActionState): Promise<ActionState> {
  const admin = await requirePermission("equipo.gestionar");
  const closed = await revokeSessions(id);
  const { ip } = await requestMeta();
  await logSecurityEvent("sesiones_cerradas", { actorId: admin.id, targetId: id, ip, detail: `${closed} sesión(es) cerrada(s) por un administrador` });
  revalidatePath("/equipo");
  return { ok: closed ? `Se han cerrado ${closed} sesión(es).` : "No tenía sesiones abiertas." };
}
