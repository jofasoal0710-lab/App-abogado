"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";
import { firstZodError, intOrNull, optStr, str, type ActionState } from "@/lib/actions";
import { canAccessEvent, canAccessMatterOrNone, canUserIdAccessMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { asSessionActor, asActor } from "@/lib/data-audit";

const eventSchema = z
  .object({
    title: z.string().min(3, "El título es obligatorio (mínimo 3 caracteres)").max(250),
    kind: z.enum(["audiencia", "plazo", "reunion", "tarea"]),
    startsAt: z.date({ error: "La fecha y hora de inicio no son válidas" }),
    endsAt: z.date().nullable(),
    matterId: z.number().int().positive().nullable(),
    assignedId: z.number().int().positive().nullable(),
    location: z.string().max(250).nullable(),
    notes: z.string().max(5000).nullable(),
  })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, {
    message: "La hora de fin no puede ser anterior al inicio",
    path: ["endsAt"],
  });

function parseDateTime(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const d = new Date(value); // se interpreta en la zona horaria del despacho (ver instrumentation.ts)
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseEvent(formData: FormData) {
  const endsRaw = str(formData, "endsAt");
  return eventSchema.safeParse({
    title: str(formData, "title"),
    kind: str(formData, "kind"),
    startsAt: parseDateTime(str(formData, "startsAt")),
    endsAt: endsRaw ? (parseDateTime(endsRaw) ?? new Date(NaN)) : null,
    matterId: intOrNull(formData, "matterId"),
    assignedId: intOrNull(formData, "assignedId"),
    location: optStr(formData, "location"),
    notes: optStr(formData, "notes"),
  });
}

/** El evento solo puede vincularse a un expediente que veas, y asignarse a alguien que también lo vea. */
async function checkEventAccess(
  user: Parameters<typeof canAccessMatterOrNone>[0],
  matterId: number | null,
  assignedId: number | null,
): Promise<string | null> {
  if (!(await canAccessMatterOrNone(user, matterId))) return ACCESS_DENIED;
  if (matterId !== null && assignedId !== null && assignedId !== user.id && !(await canUserIdAccessMatter(assignedId, matterId))) {
    return "La persona asignada no tiene acceso a ese expediente.";
  }
  return null;
}

function revalidateAgenda(matterId?: number | null) {
  revalidatePath("/agenda");
  revalidatePath("/");
  if (matterId) revalidatePath(`/expedientes/${matterId}`);
}

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseEvent(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const denied = await checkEventAccess(user, parsed.data.matterId, parsed.data.assignedId);
  if (denied) return { error: denied };

  await db.insert(events).values(parsed.data);
  revalidateAgenda(parsed.data.matterId);
  redirect(safeNext(str(formData, "returnTo"), "/agenda"));
}

export async function updateEventAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canAccessEvent(user, id))) return { error: ACCESS_DENIED };
  const parsed = parseEvent(formData);
  if (!parsed.success) return { error: firstZodError(parsed.error) };
  const denied = await checkEventAccess(user, parsed.data.matterId, parsed.data.assignedId);
  if (denied) return { error: denied };

  await asSessionActor((tx) => tx.update(events).set(parsed.data).where(eq(events.id, id)));
  revalidateAgenda(parsed.data.matterId);
  redirect(safeNext(str(formData, "returnTo"), "/agenda"));
}

export async function toggleEventAction(id: number) {
  const user = await requireUser();
  if (!(await canAccessEvent(user, id))) return;
  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return;
  await asSessionActor((tx) => tx.update(events).set({ completed: !ev.completed }).where(eq(events.id, id)));
  revalidateAgenda(ev.matterId);
}

export async function deleteEventAction(id: number) {
  const user = await requireUser();
  if (!(await canAccessEvent(user, id))) return;
  const [ev] = await asActor(user.id, (tx) => tx.delete(events).where(eq(events.id, id)).returning({ matterId: events.matterId }));
  revalidateAgenda(ev?.matterId);
}
