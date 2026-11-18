import "server-only";
import nodemailer from "nodemailer";
import type { ReminderConfig } from "./config";
import { describeMailError as describeError } from "./logic";

export type Mail = { to: string; subject: string; text: string; html: string };

export function createTransport(c: ReminderConfig) {
  return nodemailer.createTransport({
    host: c.smtp.host,
    port: c.smtp.port,
    secure: c.smtp.secure,
    // Sin TLS directo (465), exige STARTTLS: si el servidor no lo ofrece, no se envía nada (tampoco la contraseña).
    requireTLS: !c.smtp.secure && c.smtp.requireTls,
    auth: c.smtp.user ? { user: c.smtp.user, pass: c.smtp.password } : undefined,
    // Un SMTP caído no debe dejar colgada la ejecución.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendMail(c: ReminderConfig, mail: Mail): Promise<void> {
  const transport = createTransport(c);
  try {
    await transport.sendMail({ from: c.from, ...mail });
  } finally {
    transport.close();
  }
}

export function describeMailError(err: unknown, c: ReminderConfig): string {
  return describeError(err, c.smtp.password);
}
