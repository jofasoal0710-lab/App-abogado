"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { firstZodError, intOrNull, str, type ActionState } from "@/lib/actions";
import { canAccessTimeEntry, getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { parseDurationToMinutes, parseMoneyToCents } from "@/lib/money";

const entrySchema = z.object({
  matterId: z.number({ error: "Selecciona un expediente" }).int().positive("Selecciona un expediente"),
  workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
  minutes: z.number().int().min(1, "La duración debe ser de al menos 1 minuto").max(24 * 60, "La duración máxima por entrada es de 24 h"),
  description: z.string().min(3, "Describe el trabajo realizado").max(1000),
  rateCents: z.number().int().nonnegative(),
  billable: z.boolean(),
});

export async function addTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const minutes = parseDurationToMinutes(str(formData, "duration"));
  if (minutes === null) return { error: "Duración no válida. Usa formatos como 1:30, 90m, 1h 15m o 1,5." };

  const rateRaw = str(formData, "rate");
  const rateCents = rateRaw ? parseMoneyToCents(rateRaw) : user.hourlyRateCents;
  if (rateCents === null || rateCents < 0) return { error: "La tarifa por hora no es un importe válido." };

  const parsed = entrySchema.safeParse({
    matterId: intOrNull(formData, "matterId") ?? undefined,
    workedOn: str(formData, "workedOn") || todayISO(),
    minutes,
    description: str(formData, "description"),
    rateCents,
    billable: formData.get("billable") === "on",
  });
  if (!parsed.success) return { error: firstZodError(parsed.error) };

  if (!(await getAccessibleMatter(user, parsed.data.matterId))) return { error: ACCESS_DENIED };

  await db.insert(timeEntries).values({ ...parsed.data, userId: user.id });
  revalidatePath("/horas");
  revalidatePath(`/expedientes/${parsed.data.matterId}`);
  revalidatePath("/");
  return { ok: "Horas registradas." };
}

export async function deleteTimeEntryAction(entryId: number) {
  const user = await requireUser();
  if (!(await canAccessTimeEntry(user, entryId))) return;
  // Solo se pueden borrar entradas no facturadas; el autor o un administrador.
  const own = user.role === "admin" ? undefined : eq(timeEntries.userId, user.id);
  const [deleted] = await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, entryId), isNull(timeEntries.invoiceId), own))
    .returning({ matterId: timeEntries.matterId });
  if (deleted) {
    revalidatePath("/horas");
    revalidatePath(`/expedientes/${deleted.matterId}`);
    revalidatePath("/");
  }
}
