"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/actions";
import { escapeHtml } from "@/lib/reminders/logic";
import { getReminderConfig, isSmtpConfigured } from "@/lib/reminders/config";
import { describeMailError, sendMail } from "@/lib/reminders/mailer";
import { runReminders } from "@/lib/reminders/runner";

/** Envía un correo de prueba al propio administrador (nunca a una dirección arbitraria). */
export async function sendTestEmailAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  const cfg = getReminderConfig();
  if (!isSmtpConfigured(cfg)) return { error: "Configura SMTP_HOST y MAIL_FROM en el .env y reinicia la aplicación." };
  try {
    await sendMail(cfg, {
      to: admin.email,
      subject: `Prueba de correo · ${cfg.firmName}`,
      text: `Hola ${admin.name},\n\nSi lees esto, el envío de recordatorios está bien configurado.\n`,
      html: `<p>Hola ${escapeHtml(admin.name)},</p><p>Si lees esto, el envío de recordatorios está bien configurado.</p>`,
    });
    return { ok: `Correo de prueba enviado a ${admin.email}.` };
  } catch (err) {
    return { error: `No se pudo enviar: ${describeMailError(err, cfg)}` };
  }
}

export async function runRemindersNowAction(): Promise<ActionState> {
  await requireAdmin();
  const r = await runReminders();
  revalidatePath("/recordatorios");
  if (r.status === "skipped") return { error: r.reason };
  if (r.status === "locked") return { error: r.reason };
  const parts = [`${r.remindersSent} aviso(s) enviados en ${r.emailsSent} correo(s)`];
  if (r.withoutRecipient) parts.push(`${r.withoutRecipient} sin destinatario`);
  if (r.emailsFailed) return { error: `${parts.join(", ")}. Fallos: ${r.errors.join("; ")}` };
  return { ok: `${parts.join(", ")}.` };
}
