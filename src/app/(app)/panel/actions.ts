"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { sanitizeLayout } from "@/lib/dashboard-widgets";
import { can } from "@/lib/permissions";

/** Guarda la disposición del panel de la persona (siempre limpia: nada que no exista o no pueda ver). */
export async function saveDashboardLayoutAction(layout: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const clean = sanitizeLayout(layout, (p) => can(user, p));
  await db.update(users).set({ dashboardLayout: clean }).where(eq(users.id, user.id));
  revalidatePath("/");
  return { ok: true };
}

/** Vuelve al panel predeterminado. */
export async function resetDashboardAction(): Promise<void> {
  const user = await requireUser();
  await db.update(users).set({ dashboardLayout: null }).where(eq(users.id, user.id));
  revalidatePath("/");
}
