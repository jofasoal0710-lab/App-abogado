import { config as firm } from "../config";
import { parseHour, parseOffsets } from "./logic";

/** Se lee del entorno en cada llamada (no al cargar el módulo), para que la UI refleje el .env real. */
export function getReminderConfig() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    offsets: parseOffsets(process.env.REMINDER_DAYS),
    hour: parseHour(process.env.REMINDER_HOUR),
    schedulerEnabled: process.env.REMINDERS_SCHEDULER === "true",
    appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
    cronSecret: process.env.CRON_SECRET ?? "",
    from: process.env.MAIL_FROM ?? "",
    firmName: firm.firmName,
    smtp: {
      host: process.env.SMTP_HOST ?? "",
      port: Number.isInteger(port) && port > 0 ? port : 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER ?? "",
      password: process.env.SMTP_PASSWORD ?? "",
    },
  };
}

export type ReminderConfig = ReturnType<typeof getReminderConfig>;

export function isSmtpConfigured(c: ReminderConfig): boolean {
  return c.smtp.host !== "" && c.from !== "";
}
