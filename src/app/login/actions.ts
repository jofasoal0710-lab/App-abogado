"use server";

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { clearFailures, isRateLimited, registerFailure } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
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
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}|${email}`;
  if (isRateLimited(key)) {
    return { error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !user.active || !valid) {
    registerFailure(key);
    return { error: "Correo o contraseña incorrectos." };
  }

  clearFailures(key);
  await createSession(user.id);
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
