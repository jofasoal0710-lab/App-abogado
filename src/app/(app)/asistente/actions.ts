"use server";

import { answer, type AssistantAnswer } from "@/lib/assistant";
import { executeCommand, type ChatContext } from "@/lib/assistant-exec";
import { requireUser } from "@/lib/auth";

const MAX_PER_MINUTE = 30;
const recent = new Map<number, number[]>();

/** Pregunta al asistente. Solo con sesión, con un límite por persona y sin guardar las preguntas. */
function cleanContext(ctx: unknown): ChatContext {
  const c = (ctx && typeof ctx === "object" ? ctx : {}) as Record<string, unknown>;
  return {
    matterId: Number.isInteger(c.matterId) && (c.matterId as number) > 0 ? (c.matterId as number) : undefined,
    matterNumber: typeof c.matterNumber === "string" && /^EXP-\d{4}-\d{4}$/.test(c.matterNumber) ? c.matterNumber : undefined,
  };
}

/** Ejecuta una orden que la persona confirmó en el chat. Se vuelve a validar todo (permisos incluidos). */
export async function executeAssistantAction(cmd: unknown): Promise<AssistantAnswer> {
  const user = await requireUser();
  try {
    return await executeCommand(user, cmd);
  } catch (e) {
    console.error("[asistente] ejecutar:", e);
    return { text: "No se pudo completar la acción. Inténtalo de nuevo o hazlo desde la pantalla correspondiente." };
  }
}

export async function askAssistantAction(question: string, context?: unknown): Promise<AssistantAnswer> {
  const user = await requireUser();
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= MAX_PER_MINUTE) return { text: "Demasiadas preguntas seguidas. Espera un minuto." };
  recent.set(user.id, [...mine, now]);
  const q = typeof question === "string" ? question.trim().slice(0, 500) : "";
  try {
    return await answer(user, q, cleanContext(context));
  } catch (e) {
    console.error("[asistente]", e);
    return { text: "No he podido consultar los datos ahora mismo. Inténtalo de nuevo." };
  }
}
