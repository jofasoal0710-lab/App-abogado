"use server";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { MAX_PER_EMAIL, MAX_PER_IP_EMAIL, clearFailures, emailKey, ipEmailKey, isRateLimited, registerFailure } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { clientIp } from "@/lib/client-ip";
import { createSession, destroySession } from "@/lib/session";

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

  const h = await headers();
  // Solo se confía en la cabecera de IP que se configure (CLIENT_IP_HEADER); ver lib/client-ip.ts.
  const ip = clientIp((name) => h.get(name));
  const byIp = ipEmailKey(ip, email);
  const byEmail = emailKey(email);
  if ((await isRateLimited(byIp, MAX_PER_IP_EMAIL)) || (await isRateLimited(byEmail, MAX_PER_EMAIL))) {
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
    return { error: "Correo o contraseña incorrectos." };
  }

  // Solo se borra el contador de esta IP: el del correo expira solo (si no, un atacante lo reiniciaría
  // haciendo que la víctima inicie sesión).
  await clearFailures(byIp);
  await createSession(user.id);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
