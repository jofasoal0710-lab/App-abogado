"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { isClientIpTrusted } from "@/lib/client-ip";
import { PROVISIONAL_PASSWORD_DAYS, provisionalExpired } from "@/lib/passwords";
import { MAX_PER_EMAIL, MAX_PER_IP, MAX_PER_IP_EMAIL, clearFailures, emailKey, ipAnyKey, ipEmailKey, isRateLimited, registerFailure } from "@/lib/rate-limit";
import { checkSecondFactor, clearPendingLogin, readPendingLogin, setPendingLogin } from "@/lib/mfa";
import { safeNext } from "@/lib/safe-redirect";
import { loggedRecently, logSecurityEvent, requestMeta } from "@/lib/security-log";
import { createSession, destroySession } from "@/lib/session";
import { restoreUserTheme } from "@/lib/theme-server";

// Se compara siempre contra un hash real (aunque el usuario no exista) para que el
// tiempo de respuesta no revele si el correo está registrado.
let dummyHash: string | undefined;
function getDummyHash() {
  return (dummyHash ??= bcrypt.hashSync("contraseña-ficticia", 12));
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(str(formData, "next"));

  if (!email || !password) return { error: "Introduce tu correo y contraseña." };

  // Solo se confía en la cabecera de IP que se configure (CLIENT_IP_HEADER); ver lib/client-ip.ts.
  const { ip, userAgent } = await requestMeta();
  const byIp = ipEmailKey(ip, email);
  const byEmail = emailKey(email);
  // Límite por IP entre TODAS las cuentas (una contraseña probada contra muchos correos): solo si la IP es fiable.
  const byIpAny = isClientIpTrusted() ? ipAnyKey(ip) : null;
  const ipBlocked = !!byIpAny && (await isRateLimited(byIpAny, MAX_PER_IP));
  if (ipBlocked || (await isRateLimited(byIp, MAX_PER_IP_EMAIL)) || (await isRateLimited(byEmail, MAX_PER_EMAIL))) {
    // Una sola anotación por ventana (por IP si es la IP la bloqueada; si no, por correo): un ataque no
    // debe poder inundar el registro.
    if (!(await loggedRecently("login_bloqueado", ipBlocked ? { ip } : { email }, 15))) {
      await logSecurityEvent("login_bloqueado", { email, ip, detail: ipBlocked ? "Demasiados fallos desde esta IP (varias cuentas)" : null });
    }
    return { error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !user.active || !valid) {
    await registerFailure(byIp);
    await registerFailure(byEmail);
    if (byIpAny) await registerFailure(byIpAny);
    await logSecurityEvent("login_fallido", {
      email,
      ip,
      targetId: user?.id ?? null,
      detail: !user ? "Correo no registrado" : !user.active ? "Cuenta desactivada" : "Contraseña incorrecta",
    });
    return { error: "Correo o contraseña incorrectos." };
  }

  // Contraseña provisional (la conoce el administrador): solo vale unos días (SEC-008).
  if (user.mustChangePassword && provisionalExpired(user.passwordChangedAt ?? user.createdAt)) {
    await logSecurityEvent("login_fallido", { email, ip, targetId: user.id, detail: "Contraseña provisional caducada" });
    return { error: `La contraseña provisional caducó (vale ${PROVISIONAL_PASSWORD_DAYS} días). Pide al administrador que te asigne una nueva.` };
  }

  // Segundo factor (SEC-003): la sesión no se crea hasta que se confirme el código.
  if (user.mfaEnabledAt) {
    await setPendingLogin(user.id, next);
    redirect("/login/verificacion");
  }

  // Solo se borra el contador de esta IP: el del correo expira solo (si no, un atacante lo reiniciaría
  // haciendo que la víctima inicie sesión).
  await clearFailures(byIp);
  await createSession(user.id, { ip, userAgent });
  await restoreUserTheme(user.id);
  await logSecurityEvent("login_ok", { actorId: user.id, targetId: user.id, email, ip, detail: userAgent?.slice(0, 200) });
  if (user.mustChangePassword) redirect(`/cambiar-contrasena?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function logoutAction() {
  const closed = await destroySession();
  if (closed) {
    const { ip } = await requestMeta();
    await logSecurityEvent("logout", { actorId: closed.userId, targetId: closed.userId, ip });
  }
  redirect("/login");
}

/** Segundo paso del login: el código de la app de autenticación (o un código de recuperación). */
export async function verifySecondFactorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pending = await readPendingLogin();
  if (!pending) redirect("/login");
  const code = str(formData, "code");
  const { ip, userAgent } = await requestMeta();
  const key = `mfa|${pending.userId}`;
  if (await isRateLimited(key, MAX_PER_IP_EMAIL)) {
    await clearPendingLogin();
    return { error: "Demasiados códigos incorrectos. Espera 15 minutos y vuelve a entrar." };
  }
  const [user] = await db.select().from(users).where(eq(users.id, pending.userId)).limit(1);
  if (!user || !user.active || !user.mfaEnabledAt) redirect("/login");
  const how = code ? await checkSecondFactor(user.id, code) : null;
  if (!how) {
    await registerFailure(key);
    await logSecurityEvent("mfa_fallido", { email: user.email, ip, targetId: user.id });
    return { error: "Código incorrecto o caducado. Usa el que muestra ahora tu app de autenticación." };
  }
  await clearFailures(key);
  await clearFailures(ipEmailKey(ip, user.email.toLowerCase()));
  await clearPendingLogin();
  await createSession(user.id, { ip, userAgent });
  await restoreUserTheme(user.id);
  if (how === "recovery") {
    const left = (await db.select({ r: users.mfaRecoveryHashes }).from(users).where(eq(users.id, user.id)))[0]?.r?.length ?? 0;
    await logSecurityEvent("mfa_recuperacion_usada", { actorId: user.id, targetId: user.id, email: user.email, ip, detail: `Quedan ${left} código(s)` });
  }
  await logSecurityEvent("login_ok", { actorId: user.id, targetId: user.id, email: user.email, ip, detail: `Con segundo factor · ${userAgent?.slice(0, 180) ?? ""}` });
  if (user.mustChangePassword) redirect(`/cambiar-contrasena?next=${encodeURIComponent(pending.next)}`);
  redirect(safeNext(pending.next));
}
