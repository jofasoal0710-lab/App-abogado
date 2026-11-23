"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { notifyPasswordChanged } from "@/lib/account-mail";
import { getSessionUser, requireUser } from "@/lib/auth";
import { newPasswordProblem } from "@/lib/passwords";
import { clearFailures, isRateLimited, registerFailure } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";
import { readSessionCookie, revokeSessions } from "@/lib/session";
import { asSessionActor } from "@/lib/data-audit";

/** Intentos con una contraseña actual incorrecta antes de bloquear el cambio 15 minutos. */
const MAX_WRONG_CURRENT = 5;

/**
 * Cambio de la propia contraseña («Mi cuenta» y cambio obligatorio del primer acceso). Exige la actual
 * (quien solo haya robado la cookie no puede cambiarla) y cierra las demás sesiones abiertas.
 */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Admite a quien tiene el cambio pendiente: es justo para lo que sirve esta acción.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const { ip } = await requestMeta();
  const key = `pwchange|${user.id}`;

  if (await isRateLimited(key, MAX_WRONG_CURRENT)) {
    return { error: "Demasiados intentos con una contraseña actual incorrecta. Espera 15 minutos." };
  }
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await bcrypt.compare(current, row.hash))) {
    await registerFailure(key);
    await logSecurityEvent("contrasena_actual_incorrecta", { actorId: user.id, targetId: user.id, email: user.email, ip });
    return { error: "La contraseña actual no es correcta." };
  }
  const problem = newPasswordProblem(current, next, confirm);
  if (problem) return { error: problem };

  await asSessionActor(async (tx) => tx
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false, passwordChangedAt: new Date() })
    .where(eq(users.id, user.id)));
  // Se conserva la sesión desde la que se cambia; las demás (quizá robadas) dejan de valer.
  const closed = await revokeSessions(user.id, (await readSessionCookie())?.sid);
  await clearFailures(key);
  await logSecurityEvent("contrasena_cambiada", {
    actorId: user.id,
    targetId: user.id,
    email: user.email,
    ip,
    detail: closed ? `Se cerraron ${closed} sesión(es) en otros dispositivos` : null,
  });
  await notifyPasswordChanged(user, null);

  if (user.mustChangePassword) redirect(safeNext(str(formData, "next")));
  revalidatePath("/cuenta");
  return { ok: closed ? `Contraseña cambiada. Se han cerrado ${closed} sesión(es) en otros dispositivos.` : "Contraseña cambiada." };
}

/** Cierra todas mis sesiones salvo esta (p. ej. si me dejé la sesión abierta en otro ordenador). */
export async function closeOtherSessionsAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const closed = await revokeSessions(user.id, (await readSessionCookie())?.sid);
  if (closed) {
    const { ip } = await requestMeta();
    await logSecurityEvent("sesiones_cerradas", { actorId: user.id, targetId: user.id, ip, detail: `${closed} sesión(es) cerrada(s) por su titular` });
  }
  revalidatePath("/cuenta");
  return { ok: closed ? `Se han cerrado ${closed} sesión(es) en otros dispositivos.` : "No había otras sesiones abiertas." };
}
