"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { demandAnalyses, documents, events, matters, writings } from "@/db/schema";
import type { ActionState } from "@/lib/actions";
import { getAccessibleMatter } from "@/lib/access";
import { ACCESS_DENIED } from "@/lib/access-rules";
import { requireUser } from "@/lib/auth";
import { procedureDeadline } from "@/lib/calculators";
import { stampSessionActor } from "@/lib/data-audit";
import { PROCESSES, analyzeDemand, answerValues, sanitizeAnswers, type DemandAnalysis } from "@/lib/demand-analysis";
import { extractStoredText } from "@/lib/demand-db";
import { cleanValues, initialValues } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { autoValues } from "@/lib/writings";

/** La demanda analizada, solo si se tiene acceso a su expediente. */
async function loadAnalysis(id: number) {
  const user = await requireUser();
  const [row] = await db.select().from(demandAnalyses).where(eq(demandAnalyses.id, id));
  if (!row) return null;
  const matter = await getAccessibleMatter(user, row.matterId);
  if (!matter) return null;
  return { user, row, matter, analysis: row.analysis as DemandAnalysis };
}

/** Lee la demanda (documento del expediente o texto pegado), la analiza y abre la mesa de trabajo. */
export async function startDemandAnalysisAction(matterId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await getAccessibleMatter(user, matterId))) return { error: ACCESS_DENIED };
  const pasted = String(formData.get("text") ?? "").trim();
  const documentId = Number(formData.get("documentId")) || null;
  let text: string;
  let sourceName: string;
  if (pasted) {
    if (pasted.split(/\s+/).length < 40) return { error: "El texto pegado es demasiado corto para ser una demanda." };
    text = pasted.slice(0, 400_000);
    sourceName = "Texto pegado";
  } else if (documentId) {
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.matterId, matterId)));
    if (!doc) return { error: "Ese documento no es de este expediente." };
    const r = await extractStoredText(doc.storageKey, doc.mimeType);
    if (!r.ok) return { error: r.error };
    text = r.text;
    sourceName = doc.name;
  } else {
    return { error: "Elige el documento de la demanda o pega su texto." };
  }
  const analysis = analyzeDemand(text);
  const [row] = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    return tx
      .insert(demandAnalyses)
      .values({ matterId, documentId: pasted ? null : documentId, sourceName, text, analysis, answers: { process: analysis.process }, createdById: user.id })
      .returning({ id: demandAnalyses.id });
  });
  revalidatePath(`/expedientes/${matterId}/contestar`);
  redirect(`/expedientes/${matterId}/contestar/${row.id}`);
}

/** Guarda las respuestas (se llama sola mientras se trabaja, y al pulsar «Guardar»). */
export async function saveDemandAnswersAction(id: number, json: string): Promise<{ ok: boolean; error?: string; savedAt?: string }> {
  const ctx = await loadAnalysis(id);
  if (!ctx) return { ok: false, error: ACCESS_DENIED };
  if (json.length > 600_000) return { ok: false, error: "Demasiado texto." };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "Datos no válidos." };
  }
  const answers = sanitizeAnswers(raw, ctx.analysis);
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.update(demandAnalyses).set({ answers, updatedAt: new Date() }).where(eq(demandAnalyses.id, id));
  });
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Redacta la contestación con el formulario «Contestación de demanda» y la abre (se puede corregir, imprimir y descargar). */
export async function generateAnswerWritingAction(id: number) {
  const ctx = await loadAnalysis(id);
  if (!ctx) redirect("/expedientes");
  const { user, row, matter, analysis } = ctx;
  const tpl = getTemplate("contestacion-demanda")!;
  const answers = sanitizeAnswers(row.answers, analysis);
  const auto = await autoValues(user, matter.id);
  const base = initialValues(tpl, auto);
  const fromDemand = answerValues(analysis, answers);
  const values = cleanValues(tpl, {
    ...base,
    juzgado: base.juzgado || analysis.court || "",
    expediente: base.expediente || analysis.caseNumber || "",
    contraparte: analysis.plaintiffs.join(" y ") || base.contraparte || "",
    ...fromDemand,
    derecho: fromDemand.derecho || base.derecho || "",
  });
  const title = `Contestación de demanda${analysis.plaintiffs[0] ? ` de ${analysis.plaintiffs[0]}` : ""}`.slice(0, 200);
  const writingId = await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    if (row.writingId) {
      const updated = await tx.update(writings).set({ values, title, updatedAt: new Date() }).where(and(eq(writings.id, row.writingId), eq(writings.matterId, matter.id))).returning({ id: writings.id });
      if (updated.length) return updated[0].id;
    }
    const [w] = await tx.insert(writings).values({ matterId: matter.id, templateKey: tpl.key, kind: tpl.kind, title, values, createdById: user.id }).returning({ id: writings.id });
    await tx.update(demandAnalyses).set({ writingId: w.id, updatedAt: new Date() }).where(eq(demandAnalyses.id, id));
    return w.id;
  });
  revalidatePath(`/expedientes/${matter.id}`);
  redirect(`/escritos/${writingId}?creado=1`);
}

/** Añade (o mueve) el plazo para contestar en el Control de plazos, calculado en días hábiles. */
export async function addAnswerDeadlineAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await loadAnalysis(id);
  if (!ctx) return { error: ACCESS_DENIED };
  const { user, row, matter, analysis } = ctx;
  const notified = String(formData.get("notifiedOn") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notified)) return { error: "Indica la fecha en que se notificó la demanda." };
  const answers = sanitizeAnswers({ ...(row.answers as object), notifiedOn: notified }, analysis);
  const proc = PROCESSES[answers.process ?? analysis.process];
  const due = procedureDeadline({ notified, amount: proc.days, unit: "dias" }).due;
  const startsAt = new Date(`${due}T16:00:00`);
  const title = `Vence el plazo para contestar la demanda (${proc.ref})`;
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    let eventId = row.eventId;
    if (eventId) {
      const upd = await tx.update(events).set({ startsAt, title }).where(and(eq(events.id, eventId), eq(events.matterId, matter.id))).returning({ id: events.id });
      if (!upd.length) eventId = null;
    }
    if (!eventId) {
      const [e] = await tx
        .insert(events)
        .values({ matterId: matter.id, kind: "plazo", title, startsAt, notes: `${proc.label}: ${proc.days} días hábiles desde el día hábil siguiente a la notificación (${notified}). Calculado por la app; confírmalo con la resolución de traslado.`, assignedId: matter.responsibleId ?? user.id, priority: "alta", createdById: user.id })
        .returning({ id: events.id });
      eventId = e.id;
    }
    await tx.update(demandAnalyses).set({ eventId, answers, updatedAt: new Date() }).where(eq(demandAnalyses.id, id));
  });
  revalidatePath(`/expedientes/${matter.id}/contestar/${id}`);
  revalidatePath("/agenda");
  return { ok: `Plazo añadido al Control de plazos: vence el ${due.split("-").reverse().join("/")}.` };
}

/** Completa el expediente con lo que dice la demanda (juzgado, n.º de expediente judicial, parte contraria), sin pisar lo que ya tenga. */
export async function fillMatterFromDemandAction(id: number) {
  const ctx = await loadAnalysis(id);
  if (!ctx) return;
  const { matter, analysis } = ctx;
  const set: Partial<typeof matters.$inferInsert> = {};
  if (!matter.court && analysis.court) set.court = analysis.court.slice(0, 250);
  if (!matter.courtCaseNumber && analysis.caseNumber) set.courtCaseNumber = analysis.caseNumber;
  if (!matter.opposingParty && analysis.plaintiffs.length) set.opposingParty = analysis.plaintiffs.join(" y ").slice(0, 250);
  if (Object.keys(set).length) {
    await db.transaction(async (tx) => {
      await stampSessionActor(tx);
      await tx.update(matters).set(set).where(eq(matters.id, matter.id));
    });
  }
  revalidatePath(`/expedientes/${matter.id}`);
  revalidatePath(`/expedientes/${matter.id}/contestar/${id}`);
}

export async function deleteDemandAnalysisAction(id: number) {
  const ctx = await loadAnalysis(id);
  if (!ctx) return;
  await db.transaction(async (tx) => {
    await stampSessionActor(tx);
    await tx.delete(demandAnalyses).where(eq(demandAnalyses.id, id));
  });
  revalidatePath(`/expedientes/${ctx.matter.id}/contestar`);
  redirect(`/expedientes/${ctx.matter.id}/contestar`);
}
