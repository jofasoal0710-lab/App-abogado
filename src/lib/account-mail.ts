import "server-only";
import { appLocale } from "./locale";
import { getReminderConfig, isSmtpConfigured } from "./reminders/config";
import { escapeHtml } from "./reminders/logic";
import { describeMailError, sendMail } from "./reminders/mailer";

/**
 * Avisa por correo al titular de una cuenta de que su contraseña ha cambiado (OWASP-A06-002): si no fue
 * él, se entera enseguida. Nunca incluye la contraseña. Si no hay SMTP configurado o el envío falla, no se
 * bloquea el cambio (queda igualmente en el registro de seguridad). Devuelve si se envió.
 */
export async function notifyPasswordChanged(
  to: { name: string; email: string },
  admin: { name: string } | null,
  when = new Date(),
): Promise<boolean> {
  const c = getReminderConfig();
  if (!isSmtpConfigured(c)) return false;
  const date = when.toLocaleString(appLocale(), { dateStyle: "long", timeStyle: "short" });
  const how = admin
    ? `por un administrador (${admin.name}). La próxima vez que entres tendrás que elegir una contraseña nueva.`
    : "desde tu propia cuenta.";
  const text =
    `Hola ${to.name}:\n\nLa contraseña de tu cuenta en ${c.firmName} se cambió el ${date} ${how}\n\n` +
    `Si no esperabas este cambio, avisa enseguida al administrador del despacho.\n\n${c.appUrl}\n`;
  const html =
    `<p>Hola ${escapeHtml(to.name)}:</p><p>La contraseña de tu cuenta en <strong>${escapeHtml(c.firmName)}</strong> ` +
    `se cambió el ${escapeHtml(date)} ${escapeHtml(how)}</p>` +
    `<p><strong>Si no esperabas este cambio, avisa enseguida al administrador del despacho.</strong></p>` +
    `<p><a href="${escapeHtml(c.appUrl)}">${escapeHtml(c.appUrl)}</a></p>`;
  try {
    await sendMail(c, { to: to.email, subject: `${c.firmName}: la contraseña de tu cuenta ha cambiado`, text, html });
    return true;
  } catch (err) {
    console.error("[cuentas] No se pudo enviar el aviso de cambio de contraseña:", describeMailError(err, c));
    return false;
  }
}
