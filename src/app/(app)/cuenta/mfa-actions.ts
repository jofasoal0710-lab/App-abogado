"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { requirePermission, requireUser } from "@/lib/auth";
import { checkSecondFactor, encryptSecret } from "@/lib/mfa";
import { hashRecovery, newRecoveryCodes, newTotpSecret } from "@/lib/mfa-core";
import { isRateLimited, registerFailure } from "@/lib/rate-limit";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";

const off = { mfaSecret: null, mfaEnabledAt: null, mfaRecoveryHashes: null, mfaLastStep: null };

/** Paso 1: genera un secreto nuevo (aún sin activar) y muestra el código QR. */
export async function startMfaAction() {
  const user = await requireUser();
  const [u] = await db.select({ enabledAt: users.mfaEnabledAt }).from(users).where(eq(users.id, user.id));
  if (u?.enabledAt) return;
  await db.update(users).set({ ...off, mfaSecret: encryptSecret(newTotpSecret()) }).where(eq(users.id, user.id));
  revalidatePath("/cuenta");
}

export async function cancelMfaSetupAction() {
  const user = await requireUser();
  const [u] = await db.select({ enabledAt: users.mfaEnabledAt }).from(users).where(eq(users.id, user.id));
  if (u?.enabledAt) return;
  await db.update(users).set(off).where(eq(users.id, user.id));
  revalidatePath("/cuenta");
}

/** Paso 2: con el primer código correcto se activa y se entregan los códigos de recuperación (una sola vez). */
export type ConfirmState = { error?: string; codes?: string[] } | undefined;

export async function confirmMfaAction(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const user = await requireUser();
  const key = `mfa|${user.id}`;
  if (await isRateLimited(key, 5)) return { error: "Demasiados códigos incorrectos. Espera 15 minutos." };
  if (!(await checkSecondFactor(user.id, str(formData, "code"), { pending: true }))) {
    await registerFailure(key);
    return { error: "El código no coincide. Comprueba que la hora del móvil sea automática y usa el código actual." };
  }
  const codes = newRecoveryCodes();
  await db.update(users).set({ mfaEnabledAt: new Date(), mfaRecoveryHashes: codes.map(hashRecovery) }).where(eq(users.id, user.id));
  const { ip } = await requestMeta();
  await logSecurityEvent("mfa_activado", { actorId: user.id, targetId: user.id, email: user.email, ip });
  // Sin revalidar la página: los códigos siguen a la vista hasta que la persona confirme que los guardó.
  return { codes };
}

/** Desactivar exige la contraseña y un código válido: una sesión robada no basta para quitarlo. */
export async function disableMfaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = `mfa|${user.id}`;
  if (await isRateLimited(key, 5)) return { error: "Demasiados intentos. Espera 15 minutos." };
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  const okPassword = !!u && (await bcrypt.compare(String(formData.get("password") ?? ""), u.hash));
  if (!okPassword || !(await checkSecondFactor(user.id, str(formData, "code")))) {
    await registerFailure(key);
    return { error: "Contraseña o código incorrectos." };
  }
  await db.update(users).set(off).where(eq(users.id, user.id));
  const { ip } = await requestMeta();
  await logSecurityEvent("mfa_desactivado", { actorId: user.id, targetId: user.id, email: user.email, ip });
  revalidatePath("/cuenta");
  return { ok: "Verificación en dos pasos desactivada." };
}

/** Un administrador quita el segundo factor a quien perdió el móvil y los códigos (queda registrado). */
export async function resetMfaAction(userId: number) {
  const admin = await requirePermission("equipo.gestionar");
  const [t] = await db.update(users).set(off).where(eq(users.id, userId)).returning({ email: users.email });
  if (!t) return;
  const { ip } = await requestMeta();
  await logSecurityEvent("mfa_restablecido", { actorId: admin.id, targetId: userId, email: t.email, ip });
  revalidatePath(`/equipo`);
}
