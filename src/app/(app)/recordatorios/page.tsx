import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { events, matters, reminderLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, relativeDays } from "@/lib/dates";
import { eventKindLabels } from "@/lib/labels";
import { getReminderConfig, isSmtpConfigured } from "@/lib/reminders/config";
import { previewReminders } from "@/lib/reminders/runner";
import { runRemindersNowAction, sendTestEmailAction } from "./actions";

export const metadata: Metadata = { title: "Recordatorios" };

function describeOffsets(offsets: number[]): string {
  return offsets
    .map((o) => (o > 1 ? `${o} días antes` : o === 1 ? "1 día antes" : o === 0 ? "el mismo día" : `${-o} día${o === -1 ? "" : "s"} después (vencido)`))
    .join(" · ");
}

export default async function RemindersPage() {
  await requireAdmin();
  const cfg = getReminderConfig();
  const smtpOk = isSmtpConfigured(cfg);

  const [preview, history] = await Promise.all([
    smtpOk ? previewReminders() : Promise.resolve(null),
    db
      .select({
        id: reminderLog.id,
        offsetDays: reminderLog.offsetDays,
        email: reminderLog.email,
        status: reminderLog.status,
        attempts: reminderLog.attempts,
        error: reminderLog.error,
        sentAt: reminderLog.sentAt,
        createdAt: reminderLog.createdAt,
        eventId: events.id,
        eventTitle: events.title,
        eventKind: events.kind,
        startsAt: events.startsAt,
        matterId: matters.id,
        matterNumber: matters.number,
      })
      .from(reminderLog)
      .innerJoin(events, eq(events.id, reminderLog.eventId))
      .leftJoin(matters, eq(matters.id, events.matterId))
      .orderBy(desc(reminderLog.createdAt), desc(reminderLog.id))
      .limit(50),
  ]);

  const pending = preview?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <>
      <PageHeader title="Recordatorios" subtitle="Avisos por correo de plazos, audiencias y tareas" />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 font-serif text-lg font-semibold">Configuración</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Servidor SMTP">
              {smtpOk ? (
                <>
                  <span className="badge-green">Configurado</span>{" "}
                  <span className="text-ink-600">
                    {cfg.smtp.host}:{cfg.smtp.port} {cfg.smtp.secure ? "(TLS)" : "(STARTTLS)"}
                  </span>
                </>
              ) : (
                <>
                  <span className="badge-red">Sin configurar</span>{" "}
                  <span className="text-ink-600">Define SMTP_HOST y MAIL_FROM en el .env y reinicia.</span>
                </>
              )}
            </Row>
            <Row label="Remitente">{cfg.from || "—"}</Row>
            <Row label="Cuándo avisa">{describeOffsets(cfg.offsets)}</Row>
            <Row label="Envío automático">
              {cfg.schedulerEnabled ? (
                <>
                  <span className="badge-green">Planificador interno</span>{" "}
                  <span className="text-ink-600">a partir de las {cfg.hour}:00</span>
                </>
              ) : cfg.cronSecret.length >= 16 ? (
                <>
                  <span className="badge-blue">Cron externo</span>{" "}
                  <span className="text-ink-600">POST /api/cron/recordatorios con CRON_SECRET</span>
                </>
              ) : (
                <>
                  <span className="badge-amber">Solo manual</span>{" "}
                  <span className="text-ink-600">Activa REMINDERS_SCHEDULER o define CRON_SECRET.</span>
                </>
              )}
            </Row>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <ActionForm action={sendTestEmailAction}>
              <SubmitButton className="btn-secondary" pendingText="Enviando…">
                Enviar correo de prueba
              </SubmitButton>
            </ActionForm>
            <ActionForm action={runRemindersNowAction}>
              <SubmitButton className="btn-primary" pendingText="Ejecutando…">
                Enviar avisos pendientes ahora
              </SubmitButton>
            </ActionForm>
          </div>
        </section>

        <section className="card">
          <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">
            Se enviarán en la próxima ejecución {preview && <span className="text-ink-500">({pending})</span>}
          </h2>
          {!preview ? (
            <EmptyState title="Configura SMTP para ver los avisos pendientes" />
          ) : pending === 0 ? (
            <EmptyState title="No hay avisos pendientes">Todo lo que tocaba ya se ha enviado.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-100">
              {preview.groups.map((g) => (
                <li key={g.recipient.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink-900">
                    {g.recipient.name} <span className="font-normal text-ink-500">· {g.recipient.email}</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
                    {g.items.map((i) => (
                      <li key={i.eventId}>
                        {i.title}{" "}
                        <span className="text-xs text-ink-500">
                          · {eventKindLabels[i.kind]} · {formatDate(i.startsAt)} {formatTime(i.startsAt)} ({relativeDays(i.daysUntil)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {preview && preview.withoutRecipient > 0 && (
            <p className="border-t border-ink-100 px-5 py-3 text-xs text-amber-800">
              {preview.withoutRecipient} aviso(s) no tienen destinatario (evento sin responsable, usuario inactivo o con avisos desactivados).
            </p>
          )}
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Historial (últimos 50)</h2>
        {history.length === 0 ? (
          <EmptyState title="Todavía no se ha enviado ningún aviso" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Destinatario</th>
                <th>Evento</th>
                <th>Aviso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{formatDateTime(h.sentAt ?? h.createdAt)}</td>
                  <td>{h.email}</td>
                  <td>
                    {h.eventTitle}
                    <span className="block text-xs text-ink-500">
                      {eventKindLabels[h.eventKind]} · {formatDate(h.startsAt)}
                      {h.matterId && (
                        <>
                          {" · "}
                          <Link className="link" href={`/expedientes/${h.matterId}?tab=agenda`}>
                            {h.matterNumber}
                          </Link>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{h.offsetDays > 0 ? `${h.offsetDays} d. antes` : h.offsetDays === 0 ? "Mismo día" : "Vencido"}</td>
                  <td>
                    {h.status === "enviado" ? (
                      <span className="badge-green">Enviado</span>
                    ) : (
                      <>
                        <span className="badge-red">Error ({h.attempts}/3)</span>
                        {h.error && <span className="block max-w-xs text-xs text-red-700">{h.error}</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-ink-800">{children}</dd>
    </div>
  );
}
