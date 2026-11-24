"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { events } from "@/db/schema";
import { intOrNull, str, type ActionState } from "@/lib/actions";
import { canAccessEvent, canAccessMatterOrNone, canUserIdAccessMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { asSessionActor } from "@/lib/data-audit";
import { notifyTaskAssigned } from "@/lib/task-mail";
import { isTaskPriority, isTaskStatus, statusPatch } from "@/lib/tasks";

const refresh = (matterId?: number | null) => {
  revalidatePath("/tareas");
  revalidatePath("/agenda");
  revalidatePath("/", "layout");
  if (matterId) revalidatePath(`/expedientes/${matterId}`);
};

/** Mueve una tarea a otra columna del tablero (pendiente, en curso, hecha). */
export async function moveTaskAction(id: number, status: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isTaskStatus(status) || !(await canAccessEvent(user, id))) return { ok: false };
  const [t] = await asSessionActor((tx) =>
    tx.update(events).set(statusPatch(status, new Date())).where(and(eq(events.id, id), eq(events.kind, "tarea"))).returning({ matterId: events.matterId }),
  );
  if (!t) return { ok: false };
  refresh(t.matterId);
  return { ok: true };
}

/** Alta rápida desde el tablero: título, expediente (opcional), responsable, prioridad y fecha límite. */
export async function quickTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = str(formData, "title").trim();
  if (title.length < 3 || title.length > 250) return { error: "Escribe la tarea (de 3 a 250 caracteres)." };
  const matterId = intOrNull(formData, "matterId");
  const assignedId = intOrNull(formData, "assignedId") ?? user.id;
  const due = str(formData, "due");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Indica la fecha límite." };
  const priority = str(formData, "priority");
  if (!(await canAccessMatterOrNone(user, matterId))) return { error: ACCESS_DENIED };
  if (matterId !== null && assignedId !== user.id && !(await canUserIdAccessMatter(assignedId, matterId))) return { error: "La persona asignada no tiene acceso a ese expediente." };
  const [created] = await db
    .insert(events)
    .values({ kind: "tarea", title, matterId, assignedId, createdById: user.id, priority: isTaskPriority(priority) ? priority : "normal", startsAt: new Date(`${due}T17:00`) })
    .returning({ id: events.id });
  const sent = assignedId !== user.id ? await notifyTaskAssigned(created.id, user) : false;
  refresh(matterId);
  return { ok: sent ? "Tarea creada y avisada por correo." : "Tarea creada." };
}
