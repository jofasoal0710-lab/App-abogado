"use server";

import { revalidatePath } from "next/cache";
import { str, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { normalizeTheme } from "@/lib/theme";
import { currentTheme, saveUserTheme } from "@/lib/theme-server";

export async function saveAppearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await saveUserTheme(user.id, normalizeTheme({ mode: str(formData, "mode"), palette: str(formData, "palette"), sidebar: str(formData, "sidebar") }));
  revalidatePath("/", "layout");
  return { ok: "Apariencia guardada." };
}

/** Botón rápido sol/luna: alterna claro ↔ oscuro (desde «automático» pasa a oscuro). */
export async function toggleDarkAction() {
  const user = await requireUser();
  const t = await currentTheme();
  await saveUserTheme(user.id, { ...t, mode: t.mode === "dark" ? "light" : "dark" });
  revalidatePath("/", "layout");
}
