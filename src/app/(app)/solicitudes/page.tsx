import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { CopyButton } from "@/components/copy-button";
import { ActionForm, SubmitButton } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { intakeFiles, intakeRequests } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { CONTACT_OPTIONS, INTAKE_STATUSES, type IntakeStatus } from "@/lib/intake";
import { getIntakeSettings } from "@/lib/intake-db";
import { areaLabels } from "@/lib/labels";
import { getReminderConfig } from "@/lib/reminders/config";
import { saveIntakeSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Solicitudes de nuevos clientes" };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Bandeja de solicitudes que llegan por el formulario público, y ajustes del formulario. */
export default async function IntakeListPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requirePermission("solicitudes.gestionar");
  const { estado } = await searchParams;
  const status: IntakeStatus = estado && estado in INTAKE_STATUSES ? (estado as IntakeStatus) : "pendiente";
  const [settings, counts, rows] = await Promise.all([
    getIntakeSettings(),
    db.select({ status: intakeRequests.status, n: count() }).from(intakeRequests).groupBy(intakeRequests.status),
    db
      .select({
        id: intakeRequests.id,
        name: intakeRequests.name,
        clientType: intakeRequests.clientType,
        area: intakeRequests.area,
        summary: intakeRequests.summary,
        deadline: intakeRequests.deadline,
        preferredContact: intakeRequests.preferredContact,
        createdAt: intakeRequests.createdAt,
        files: sql<number>`(select count(*)::int from ${intakeFiles} where ${intakeFiles.requestId} = ${intakeRequests.id})`,
      })
      .from(intakeRequests)
      .where(eq(intakeRequests.status, status))
      .orderBy(status === "pendiente" ? sql`${intakeRequests.deadline} asc nulls last, ${intakeRequests.createdAt} asc` : desc(intakeRequests.createdAt))
      .limit(200),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const publicUrl = `${getReminderConfig().appUrl}/solicitud`;
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Solicitudes de nuevos clientes"
        subtitle="Consultas que llegan por el formulario público. Revisa los conflictos y conviértelas en cliente y expediente con un clic."
      />

      <section className="card card-pad mb-6" aria-labelledby="form-publico">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="form-publico" className="font-semibold text-ink-900">
              Formulario público{" "}
              <span className={settings.enabled ? "badge-green" : "badge-gray"}>{settings.enabled ? "Activado" : "Desactivado"}</span>
            </h2>
            <p className="mt-1 text-sm text-ink-600">Comparte este enlace en tu web, redes sociales o WhatsApp:</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-ink-100 px-2 py-1 text-sm">{publicUrl}</code>
              <CopyButton text={publicUrl} label="Copiar enlace" className="btn-secondary btn-sm" />
              <a href="/solicitud" target="_blank" rel="noopener" className="btn-ghost btn-sm">
                Ver formulario ↗
              </a>
            </div>
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-700">Ajustes del formulario</summary>
          <ActionForm action={saveIntakeSettingsAction} className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4" />
              Recibir solicitudes por el formulario público
            </label>
            <label className="block">
              <span className="label">Texto de bienvenida (opcional)</span>
              <textarea className="input min-h-20" name="intro" maxLength={2000} defaultValue={settings.intro ?? ""} placeholder="Rellena este formulario y un abogado o abogada del despacho revisará tu consulta y te contactará." />
            </label>
            <p className="hint">Llega un aviso por correo a quien revisa solicitudes (si el correo está configurado). Las descartadas se borran solas a los 6 meses.</p>
            <SubmitButton>Guardar ajustes</SubmitButton>
          </ActionForm>
        </details>
      </section>

      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Estado de las solicitudes">
        {(Object.keys(INTAKE_STATUSES) as IntakeStatus[]).map((s) => (
          <Link
            key={s}
            href={s === "pendiente" ? "/solicitudes" : `/solicitudes?estado=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${s === status ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"}`}
          >
            {INTAKE_STATUSES[s]}s <span className="tabular-nums opacity-80">({n(s)})</span>
          </Link>
        ))}
      </nav>

      <div className="card divide-y divide-ink-100">
        {rows.length === 0 ? (
          <EmptyState title={status === "pendiente" ? "No hay solicitudes pendientes" : `No hay solicitudes ${INTAKE_STATUSES[status].toLowerCase()}s`}>
            {status === "pendiente" && !settings.enabled ? "Activa el formulario público en «Ajustes del formulario» para empezar a recibirlas." : null}
          </EmptyState>
        ) : (
          rows.map((r) => {
            const left = r.deadline ? daysBetween(today, r.deadline) : null;
            return (
              <Link key={r.id} href={`/solicitudes/${r.id}`} className="block px-5 py-4 hover:bg-ink-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink-900">{r.name}</span>
                  {r.clientType === "empresa" && <span className="badge-gray">Empresa</span>}
                  <span className="badge-blue">{areaLabels[r.area]}</span>
                  {left !== null && status === "pendiente" && (
                    <span className={left <= 3 ? "badge-red" : left <= 10 ? "badge-amber" : "badge-gray"}>
                      {left < 0 ? `Fecha límite pasada (${formatDate(r.deadline!)})` : left === 0 ? "Fecha límite: hoy" : `Fecha límite en ${left} día${left === 1 ? "" : "s"}`}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-ink-500">{r.createdAt.toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.TZ || "America/Costa_Rica" })}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-600">{r.summary}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {r.files ? `${r.files} documento${r.files === 1 ? "" : "s"} · ` : ""}
                  {r.preferredContact ? `Prefiere: ${CONTACT_OPTIONS[r.preferredContact as keyof typeof CONTACT_OPTIONS] ?? r.preferredContact}` : "Sin preferencia de contacto"}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
