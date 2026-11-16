"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { firstZodError, str, type ActionState } from "@/lib/actions";
import { countSoleHolderConfidential } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";

const passwordSchema = z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(200);

const baseSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(150),
  email: z.email("El correo electrónico no es válido").max(200),
  role: z.enum(["admin", "abogado", "asistente"]),
  hourlyRateCents: z.number({ error: "La tarifa por hora no es válida" }).int().nonnegative(),
});

function parseBase(formData: FormData) {
  const rateRaw = str(formData, "hourlyRate");
  const rate = rateRaw === "" ? 0 : parseMoneyToCents(rateRaw);
  return baseSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    role: str(formData, "role"),
    hourlyRateCents: rate ?? undefined,
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
  await requireAdmin();
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return { error: firstZodError(password.error) };
  if (await emailTaken(parsed.data.email)) return { error: "Ya existe un usuario con ese correo." };

  await db.insert(users).values({
    ...parsed.data,
    emailReminders: formData.get("emailReminders") === "on",
    passwordHash: await bcrypt.hash(password.data, 12),
  });
  revalidatePath("/equipo");
  return { ok: `Usuario ${parsed.data.name} creado.` };
}

export async function updateUserAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseBase(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const active = formData.get("active") === "on";

  if (await emailTaken(parsed.data.email, id)) return { error: "Ya existe otro usuario con ese correo." };

  // Evita quedarse sin administradores (ni auto-bloquearse).
  const losesAdmin = parsed.data.role !== "admin" || !active;
  if (losesAdmin) {
    if (id === admin.id) return { error: "No puedes quitarte a ti mismo el rol de administrador ni desactivarte." };
    const [{ n }] = await db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, id)));
    const [target] = await db.select({ role: users.role, active: users.active }).from(users).where(eq(users.id, id));
    if (target?.role === "admin" && target.active && n === 0) {
      return { error: "Debe quedar al menos un administrador activo." };
    }
  }

  // No se puede desactivar a la única persona con acceso a un expediente confidencial: quedaría huérfano.
  if (!active) {
    const n = await countSoleHolderConfidential(id);
    if (n > 0) {
      return { error: `No se puede desactivar: es la única persona activa con acceso a ${n} expediente(s) confidencial(es). Que su responsable añada antes a otra persona.` };
    }
  }

  const newPassword = String(formData.get("password") ?? "");
  const set: Partial<typeof users.$inferInsert> = {
    ...parsed.data,
    active,
    emailReminders: formData.get("emailReminders") === "on",
  };
  if (newPassword) {
    const pw = passwordSchema.safeParse(newPassword);
    if (!pw.success) return { error: firstZodError(pw.error) };
    set.passwordHash = await bcrypt.hash(pw.data, 12);
  }

  await db.update(users).set(set).where(eq(users.id, id));
  revalidatePath("/equipo");
  return { ok: "Cambios guardados." };
}
