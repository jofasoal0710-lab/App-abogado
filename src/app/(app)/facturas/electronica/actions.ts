"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { einvoiceSettings } from "@/db/schema";
import { str, type ActionState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth";
import { emitterProblem, type EmitterSettings } from "@/lib/einvoice/build";
import { HaciendaFailure, missingCredentials, testConnection } from "@/lib/einvoice/hacienda";
import { checkEinvoiceStatus, sendInvoiceToHacienda } from "@/lib/einvoice/service";

/** Límite sencillo por persona y minuto (como el asistente): evita ráfagas contra Hacienda. */
const recent = new Map<string, number[]>();
async function rateLimit(key: string, max: number, seconds: number): Promise<boolean> {
  const now = Date.now();
  const mine = (recent.get(key) ?? []).filter((t) => now - t < seconds * 1000);
  if (mine.length >= max) return false;
  recent.set(key, [...mine, now]);
  return true;
}

const digits = (v: string) => v.replace(/\D/g, "");

export async function saveEinvoiceSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("facturacion.emitir");
  const data: EmitterSettings = {
    name: str(formData, "name").trim(),
    idType: str(formData, "idType"),
    idNumber: digits(str(formData, "idNumber")),
    commercialName: str(formData, "commercialName").trim() || null,
    email: str(formData, "email").trim(),
    phone: digits(str(formData, "phone")) || null,
    province: str(formData, "province").trim(),
    canton: str(formData, "canton").trim().padStart(2, "0"),
    district: str(formData, "district").trim().padStart(2, "0"),
    otherSigns: str(formData, "otherSigns").trim(),
    activityCode: str(formData, "activityCode").trim().replace(".", ""),
    branch: digits(str(formData, "branch")).padStart(3, "0"),
    terminal: digits(str(formData, "terminal")).padStart(5, "0"),
    defaultCabys: digits(str(formData, "defaultCabys")),
    paymentMethod: str(formData, "paymentMethod"),
    providerId: digits(str(formData, "providerId")) || null,
  };
  const problem = emitterProblem(data);
  if (problem) return { error: problem };
  await db
    .insert(einvoiceSettings)
    .values({ id: 1, ...data })
    .onConflictDoUpdate({ target: einvoiceSettings.id, set: { ...data, updatedAt: new Date() } });
  revalidatePath("/facturas/electronica");
  return { ok: "Datos del emisor guardados." };
}

export async function testHaciendaAction(_prev: ActionState): Promise<ActionState> {
  const user = await requirePermission("facturacion.emitir");
  if (!(await rateLimit(`hacienda-test:${user.id}`, 5, 60))) return { error: "Demasiados intentos. Espera un minuto." };
  const missing = missingCredentials();
  if (missing.length) return { error: `Faltan en el servidor: ${missing.join(", ")}.` };
  try {
    await testConnection();
  } catch (e) {
    if (e instanceof HaciendaFailure) return { error: e.message };
    throw e;
  }
  return { ok: "Conexión correcta: Hacienda aceptó el usuario del API." };
}

function back(invoiceId: number, r: { ok: string } | { error: string }): never {
  const q = "ok" in r ? `fe_ok=${encodeURIComponent(r.ok)}` : `fe_error=${encodeURIComponent(r.error)}`;
  redirect(`/facturas/${invoiceId}?${q}#hacienda`);
}

export async function sendToHaciendaAction(invoiceId: number) {
  const user = await requirePermission("facturacion.emitir");
  if (!(await rateLimit(`hacienda-send:${user.id}`, 10, 60))) back(invoiceId, { error: "Demasiados envíos seguidos. Espera un minuto." });
  const r = await sendInvoiceToHacienda(user, invoiceId);
  revalidatePath(`/facturas/${invoiceId}`);
  back(invoiceId, r);
}

export async function checkHaciendaStatusAction(invoiceId: number, einvoiceId: number) {
  const user = await requirePermission("facturacion.emitir");
  if (!(await rateLimit(`hacienda-status:${user.id}`, 20, 60))) back(invoiceId, { error: "Demasiadas consultas seguidas. Espera un minuto." });
  const r = await checkEinvoiceStatus(user, einvoiceId);
  revalidatePath(`/facturas/${invoiceId}`);
  back(invoiceId, "ok" in r ? { ok: r.ok } : { error: r.error });
}
