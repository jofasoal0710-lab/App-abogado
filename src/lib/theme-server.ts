import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeTheme, THEME_COOKIE, themeFromCookie, themeToCookie, type Theme } from "./theme";

/** Apariencia de esta petición (de la cookie; si no hay, la de por defecto). */
export async function currentTheme(): Promise<Theme> {
  return themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
}

/** Pone la cookie (un año; no es un dato sensible, solo colores). */
export async function setThemeCookie(t: Theme) {
  (await cookies()).set(THEME_COOKIE, themeToCookie(t), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 365 * 24 * 3600,
  });
}

/** Al iniciar sesión: recupera la apariencia guardada en la cuenta (sirve en cualquier dispositivo). */
export async function restoreUserTheme(userId: number) {
  const [u] = await db.select({ mode: users.themeMode, palette: users.themePalette, sidebar: users.themeSidebar }).from(users).where(eq(users.id, userId));
  if (u && (u.mode || u.palette || u.sidebar)) await setThemeCookie(normalizeTheme(u));
}

export async function saveUserTheme(userId: number, t: Theme) {
  await db.update(users).set({ themeMode: t.mode, themePalette: t.palette, themeSidebar: t.sidebar }).where(eq(users.id, userId));
  await setThemeCookie(t);
}
