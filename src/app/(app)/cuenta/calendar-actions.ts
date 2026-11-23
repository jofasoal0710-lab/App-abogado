"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hashCalendarToken, newCalendarToken } from "@/lib/calendar-feed";
import { getReminderConfig } from "@/lib/reminders/config";
import { logSecurityEvent, requestMeta } from "@/lib/security-log";

export type CalendarLinkState = { url?: string; error?: string } | undefined;

/** Crea (o reemplaza) el enlace privado. El enlace anterior deja de funcionar. Se muestra una sola vez. */
export async function createCalendarLinkAction(_prev: CalendarLinkState): Promise<CalendarLinkState> {
  const user = await requireUser();
  const token = newCalendarToken();
  await db.update(users).set({ calendarTokenHash: hashCalendarToken(token) }).where(eq(users.id, user.id));
  const { ip } = await requestMeta();
  await logSecurityEvent("calendario_enlace_creado", { actorId: user.id, targetId: user.id, email: user.email, ip });
  return { url: `${getReminderConfig().appUrl}/api/agenda/feed?t=${token}` };
}

export async function revokeCalendarLinkAction() {
  const user = await requireUser();
  await db.update(users).set({ calendarTokenHash: null }).where(eq(users.id, user.id));
  const { ip } = await requestMeta();
  await logSecurityEvent("calendario_enlace_revocado", { actorId: user.id, targetId: user.id, email: user.email, ip });
  revalidatePath("/cuenta");
}
