"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { matters, runningTimers, timeEntries } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { todayISO } from "@/lib/dates";
import { formatDuration } from "@/lib/money";
import { billableMinutes, elapsedSeconds } from "@/lib/timer";

const refreshAll = (matterId?: number) => {
  revalidatePath("/", "layout");
  if (matterId) revalidatePath(`/expedientes/${matterId}`);
};

/** Pone en marcha el cronómetro en un expediente. Si ya había uno, hay que detenerlo antes. */
export async function startTimerAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const description = str(formData, "description").slice(0, 1000);
  const [created] = await db.insert(runningTimers).values({ userId: user.id, matterId, description, startedAt: new Date() }).onConflictDoNothing().returning({ userId: runningTimers.userId });
  if (!created) return { error: "Ya tienes un cronómetro en marcha. Detenlo (o descártalo) antes de empezar otro." };
  refreshAll(matterId);
  return { ok: "Cronómetro en marcha." };
}

/** Pausa o reanuda. Al pausar, lo medido se suma a lo acumulado. */
export async function toggleTimerAction(): Promise<void> {
  const user = await requireUser();
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(runningTimers).where(eq(runningTimers.userId, user.id)).for("update");
    if (!t) return;
    const now = new Date();
    await tx
      .update(runningTimers)
      .set(t.startedAt ? { startedAt: null, accumulatedSeconds: elapsedSeconds(t, now) } : { startedAt: now })
      .where(eq(runningTimers.userId, user.id));
  });
  refreshAll();
}

/**
 * Detiene el cronómetro y registra las horas en el expediente, redondeadas hacia arriba al tramo
 * configurado, con la tarifa que correspondería al registrarlas a mano. Se borra en la misma transacción:
 * un doble clic no registra las horas dos veces.
 */
export async function stopTimerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const description = str(formData, "description").trim();
  if (description.length < 3) return { error: "Describe el trabajo realizado (mínimo 3 caracteres)." };
  const billable = formData.get("billable") === "on";
  const res = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(runningTimers).where(eq(runningTimers.userId, user.id)).for("update");
    if (!t) return { error: "No tienes ningún cronómetro en marcha." } as const;
    // El acceso se comprueba al detenerlo: si entretanto le quitaron el expediente, no se registra nada.
    if (!(await getAccessibleMatter(user, t.matterId))) {
      await tx.delete(runningTimers).where(eq(runningTimers.userId, user.id));
      return { error: ACCESS_DENIED } as const;
    }
    const minutes = billableMinutes(elapsedSeconds(t, new Date()), config.timerRoundMinutes);
    if (minutes > 24 * 60) return { error: "El cronómetro lleva más de 24 horas: seguramente se quedó encendido. Descártalo y registra las horas a mano." } as const;
    const [m] = await tx.select({ rate: matters.hourlyRateCents, type: matters.billingType }).from(matters).where(eq(matters.id, t.matterId));
    const rateCents = m?.type === "por_horas" && m.rate ? m.rate : user.hourlyRateCents;
    await tx.insert(timeEntries).values({ matterId: t.matterId, userId: user.id, workedOn: todayISO(), minutes, description: description.slice(0, 1000), rateCents, billable });
    await tx.delete(runningTimers).where(eq(runningTimers.userId, user.id));
    return { ok: `Registradas ${formatDuration(minutes)} en el expediente.`, matterId: t.matterId } as const;
  });
  if ("error" in res) {
    if (res.error === ACCESS_DENIED) refreshAll();
    return { error: res.error };
  }
  revalidatePath("/horas");
  refreshAll(res.matterId);
  return { ok: res.ok };
}

/** Descarta el cronómetro sin registrar nada. */
export async function discardTimerAction(): Promise<void> {
  const user = await requireUser();
  await db.delete(runningTimers).where(eq(runningTimers.userId, user.id));
  refreshAll();
}
