"use server";

import { answer, type AssistantAnswer } from "@/lib/assistant";
import { requireUser } from "@/lib/auth";

const MAX_PER_MINUTE = 30;
const recent = new Map<number, number[]>();

/** Pregunta al asistente. Solo con sesión, con un límite por persona y sin guardar las preguntas. */
export async function askAssistantAction(question: string): Promise<AssistantAnswer> {
  const user = await requireUser();
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (mine.length >= MAX_PER_MINUTE) return { text: "Demasiadas preguntas seguidas. Espera un minuto." };
  recent.set(user.id, [...mine, now]);
  const q = typeof question === "string" ? question.trim().slice(0, 300) : "";
  try {
    return await answer(user, q);
  } catch (e) {
    console.error("[asistente]", e);
    return { text: "No he podido consultar los datos ahora mismo. Inténtalo de nuevo." };
  }
}
