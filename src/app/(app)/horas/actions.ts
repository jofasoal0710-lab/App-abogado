"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
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
import { can } from "@/lib/permissions";

const entrySchema = z.object({
  matterId: z.number({ error: "Selecciona un expediente" }).int().positive("Selecciona un expediente"),
  workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
  minutes: z.number().int().min(1, "La duración debe ser de al menos 1 minuto").max(24 * 60, "La duración máxima por entrada es de 24 h"),
  description: z.string().min(3, "Describe el trabajo realizado").max(1000),
  rateCents: z.number().int().nonnegative(),
  billable: z.boolean(),
});

/** Lee y valida los campos del formulario de horas (alta y edición). */
function parseEntry(formData: FormData, defaultRateCents: number) {
  const minutes = parseDurationToMinutes(str(formData, "duration"));
  if (minutes === null) return { error: "Duración no válida. Usa formatos como 1:30, 90m, 1h 15m o 1,5." } as const;
  const rateRaw = str(formData, "rate");
  const rateCents = rateRaw ? parseMoneyToCents(rateRaw) : defaultRateCents;
  if (rateCents === null || rateCents < 0) return { error: "La tarifa por hora no es un importe válido." } as const;
  const parsed = entrySchema.safeParse({
    matterId: intOrNull(formData, "matterId") ?? undefined,
    workedOn: str(formData, "workedOn") || todayISO(),
    minutes,
    description: str(formData, "description"),
    rateCents,
    billable: formData.get("billable") === "on",
  });
  return parsed.success ? ({ data: parsed.data } as const) : ({ error: firstZodError(parsed.error) } as const);
}

/** Solo el autor (o quien pueda gestionar horas de otras personas) y solo si aún no está facturada. */
function editableBy(user: Awaited<ReturnType<typeof requireUser>>) {
  return and(isNull(timeEntries.invoiceId), can(user, "horas.borrar_todas") ? undefined : eq(timeEntries.userId, user.id));
}

function revalidateHours(matterIds: number[]) {
  revalidatePath("/horas");
  for (const id of new Set(matterIds)) revalidatePath(`/expedientes/${id}`);
  revalidatePath("/");
}

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
  // Solo se pueden borrar entradas no facturadas; el autor o quien pueda «borrar horas de otras personas».
  const own = can(user, "horas.borrar_todas") ? undefined : eq(timeEntries.userId, user.id);
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

/** Corrige una entrada mal escrita (fecha, duración, tarifa, descripción, facturable o expediente). */
export async function updateTimeEntryAction(entryId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canAccessTimeEntry(user, entryId))) return { error: ACCESS_DENIED };
  const entry = parseEntry(formData, user.hourlyRateCents);
  if ("error" in entry) return { error: entry.error };
  if (!(await getAccessibleMatter(user, entry.data.matterId))) return { error: ACCESS_DENIED };

  const [before] = await db.select({ matterId: timeEntries.matterId }).from(timeEntries).where(eq(timeEntries.id, entryId));
  const [updated] = await db
    .update(timeEntries)
    .set(entry.data)
    .where(and(eq(timeEntries.id, entryId), editableBy(user)))
    .returning({ matterId: timeEntries.matterId });
  if (!updated) return { error: "No se puede modificar: ya está facturada o no es tuya." };
  revalidateHours([updated.matterId, ...(before ? [before.matterId] : [])]);
  return { ok: "Cambios guardados." };
}

/**
 * Borra de una vez las entradas marcadas (p. ej. duplicados o registros guardados por error). Solo se
 * borran las que la persona puede borrar: suyas (o con el permiso) y sin facturar; el resto se ignora.
 */
export async function deleteTimeEntriesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ids = [...new Set(formData.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (ids.length === 0) return { error: "Marca al menos una entrada." };

  const allowed = [];
  for (const id of ids) if (await canAccessTimeEntry(user, id)) allowed.push(id);
  const deleted = allowed.length
    ? await db.delete(timeEntries).where(and(inArray(timeEntries.id, allowed), editableBy(user))).returning({ matterId: timeEntries.matterId })
    : [];
  revalidateHours(deleted.map((d) => d.matterId));
  const skipped = ids.length - deleted.length;
  if (deleted.length === 0) return { error: "No se ha borrado ninguna: las marcadas están facturadas o no puedes borrarlas." };
  return {
    ok: `${deleted.length} ${deleted.length === 1 ? "entrada borrada" : "entradas borradas"}.${skipped ? ` ${skipped} no se ${skipped === 1 ? "pudo" : "pudieron"} borrar (facturadas o de otra persona).` : ""}`,
  };
}
