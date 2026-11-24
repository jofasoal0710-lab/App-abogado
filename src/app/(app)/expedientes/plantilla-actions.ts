"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { canUserIdAccessMatter, getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { stampSessionActor } from "@/lib/data-audit";
import { getTemplate } from "@/lib/process-templates";
import { revalidatePath } from "next/cache";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Crea los plazos y tareas de una plantilla en el expediente, tal como quedaron en la vista previa
 * (la persona puede quitar pasos, cambiar títulos y fechas). Todo en una transacción: o se crean todos o ninguno.
 */
export async function applyTemplateAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const t = getTemplate(str(formData, "template"));
  if (!t) return { error: "Elige una plantilla." };
  const base = str(formData, "base");
  if (!ISO.test(base)) return { error: "La fecha base no es válida." };
  const assignedId = Number(str(formData, "assignedId")) || null;
  if (assignedId && assignedId !== user.id && !(await canUserIdAccessMatter(assignedId, matterId))) return { error: "La persona asignada no tiene acceso a este expediente." };

  const rows: (typeof events.$inferInsert)[] = [];
  for (let i = 0; i < t.steps.length; i++) {
    if (formData.get(`inc_${i}`) !== "on") continue;
    const step = t.steps[i];
    const title = str(formData, `title_${i}`).trim().slice(0, 250);
    const date = str(formData, `date_${i}`);
    if (title.length < 3) return { error: `El paso ${i + 1} necesita un título.` };
    if (!ISO.test(date)) return { error: `La fecha del paso ${i + 1} no es válida.` };
    const note = str(formData, `note_${i}`).slice(0, 1000);
    rows.push({
      matterId,
      kind: step.type,
      title,
      // Los plazos vencen al final de la jornada; las tareas se colocan a primera hora.
      startsAt: new Date(`${date}T${step.type === "plazo" ? "16:00" : "08:00"}`),
      assignedId: assignedId ?? user.id,
      createdById: user.id,
      notes: `Plantilla «${t.name}» (fecha base ${base.split("-").reverse().join("/")}).${note ? " " + note : ""} Verifica el cómputo con la notificación real.`,
    });
  }
  if (!rows.length) return { error: "Marca al menos un paso." };
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.insert(events).values(rows);
  });
  revalidatePath(`/expedientes/${matterId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/expedientes/${matterId}?tab=agenda&plantilla=${rows.length}`);
}
