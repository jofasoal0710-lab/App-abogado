import type { Metadata } from "next";
import { HelpButton } from "@/components/help/help-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Icon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui";
import { db } from "@/db";
import { clients, intakeFiles, intakeRequests, matters, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { ID_TYPES, MARITAL_STATUS, formatId } from "@/lib/cr-id";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatBytes } from "@/lib/file-types";
import { CONTACT_OPTIONS, INTAKE_STATUSES, type IntakeStatus } from "@/lib/intake";
import { findConflicts } from "@/lib/intake-db";
import { areaLabels } from "@/lib/labels";
import { deleteIntakeAction, discardIntakeAction, reopenIntakeAction } from "../actions";

export const metadata: Metadata = { title: "Solicitud" };

const KIND_LABEL = { cliente: "Ya es cliente", contraparte: "Es parte contraria", contraparte_es_cliente: "Contraparte es cliente", solicitud: "Solicitud anterior" } as const;

export default async function IntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("solicitudes.gestionar");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [req] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id));
  if (!req) notFound();
  const [files, hits, reviewer, client, matter] = await Promise.all([
    db.select().from(intakeFiles).where(eq(intakeFiles.requestId, id)),
    req.status === "pendiente" ? findConflicts(user, req) : Promise.resolve([]),
    req.reviewedById ? db.select({ name: users.name }).from(users).where(eq(users.id, req.reviewedById)).then((r) => r[0]) : undefined,
    req.clientId ? db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, req.clientId)).then((r) => r[0]) : undefined,
    req.matterId ? db.select({ id: matters.id, number: matters.number }).from(matters).where(eq(matters.id, req.matterId)).then((r) => r[0]) : undefined,
  ]);
  const status = req.status as IntakeStatus;
  const strong = hits.some((h) => h.kind === "contraparte" || h.kind === "contraparte_es_cliente");
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
        <dt className="text-ink-500">{label}</dt>
        <dd className="min-w-0 break-words text-ink-900">{value}</dd>
      </div>
    ) : null;

  return (
    <>
      <Breadcrumbs items={[{ label: "Solicitudes", href: "/solicitudes" }, { label: req.name }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2" data-tour="titulo">
            <h1 className="font-serif text-2xl font-semibold">{req.name}</h1>
            <HelpButton />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {areaLabels[req.area]} · recibida el {formatDateTime(req.createdAt)} ·{" "}
            <span className={status === "pendiente" ? "badge-amber" : status === "aceptada" ? "badge-green" : "badge-gray"}>{INTAKE_STATUSES[status]}</span>
          </p>
        </div>
        {status === "pendiente" && (
          <Link href={`/solicitudes/${id}/aceptar`} className="btn-primary">
            Aceptar: crear cliente y expediente
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card card-pad" aria-labelledby="caso">
            <h2 id="caso" className="font-semibold">Su caso</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-800">{req.summary}</p>
            <dl className="mt-3 divide-y divide-ink-100 border-t border-ink-100">
              {row("Parte contraria", req.opposingParty)}
              {row("Fecha límite", req.deadline ? formatDate(req.deadline) : null)}
            </dl>
          </section>

          <section className="card card-pad" aria-labelledby="docs">
            <h2 id="docs" className="font-semibold">Documentos aportados</h2>
            {files.length ? (
              <ul className="mt-2 divide-y divide-ink-100">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
                    <Icon name="documentos" className="h-4 w-4 text-ink-400" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-ink-500">{formatBytes(f.sizeBytes)}</span>
                    <a href={`/api/solicitudes/archivos/${f.id}`} className="btn-ghost btn-sm">
                      Descargar
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-500">{status === "aceptada" ? "Los documentos pasaron al expediente." : "No adjuntó documentos."}</p>
            )}
            <p className="hint mt-2">Ábrelos con cuidado: vienen de una persona desconocida. Al aceptar la solicitud pasan a los documentos del expediente.</p>
          </section>

          {status === "pendiente" && (
            <section className={`card card-pad ${hits.length ? (strong ? "border-red-300" : "border-amber-300") : ""}`} aria-labelledby="conflictos">
              <h2 id="conflictos" className="flex items-center gap-2 font-semibold">
                <Icon name="balanza" className="h-5 w-5" /> Revisión de conflictos de interés
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Se buscó a <strong>{req.name}</strong>
                {req.taxId ? ` (identificación ${formatId(req.idType, req.taxId)})` : ""}
                {req.opposingParty ? <> y a la parte contraria <strong>{req.opposingParty}</strong></> : ""} entre los clientes, las partes contrarias de los expedientes y las solicitudes anteriores.
              </p>
              {hits.length === 0 ? (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ Sin coincidencias.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {hits.map((h, i) => (
                    <li key={i} className={`rounded-lg px-3 py-2 text-sm ${h.kind === "contraparte" || h.kind === "contraparte_es_cliente" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                      <span className="font-semibold">{KIND_LABEL[h.kind]}{h.byId ? " · coincidencia exacta" : " · por nombre"}:</span>{" "}
                      {h.href ? (
                        <Link href={h.href} className="underline underline-offset-2">
                          {h.label}
                        </Link>
                      ) : (
                        h.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint mt-2">
                Las coincidencias por nombre pueden ser homónimos: compruébalas. Si la persona es la parte contraria en un asunto del despacho, normalmente no se puede aceptar el caso.
              </p>
            </section>
          )}

          {status !== "pendiente" && (
            <section className="card card-pad text-sm" aria-labelledby="decision">
              <h2 id="decision" className="font-semibold">Decisión</h2>
              <p className="mt-1">
                {INTAKE_STATUSES[status]} por {reviewer?.name ?? "—"} el {req.reviewedAt ? formatDateTime(req.reviewedAt) : "—"}.
              </p>
              {client && (
                <p className="mt-1">
                  Cliente: <Link href={`/clientes/${client.id}`} className="link">{client.name}</Link>
                  {matter && (
                    <>
                      {" "}· Expediente: <Link href={`/expedientes/${matter.id}`} className="link">{matter.number}</Link>
                    </>
                  )}
                </p>
              )}
              {req.reviewNote && <p className="mt-2 whitespace-pre-line text-ink-700">Nota: {req.reviewNote}</p>}
              {req.conflictSummary && <p className="mt-2 text-xs text-ink-500">{req.conflictSummary}</p>}
              {status === "descartada" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={reopenIntakeAction.bind(null, id)}>
                    <button className="btn-secondary btn-sm">Volver a pendiente</button>
                  </form>
                  <form action={deleteIntakeAction.bind(null, id)}>
                    <ConfirmButton message="¿Borrar la solicitud y sus documentos para siempre? (Por ejemplo, si la persona pidió eliminar sus datos.)">Borrar ahora</ConfirmButton>
                  </form>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card card-pad" aria-labelledby="contacto">
            <h2 id="contacto" className="font-semibold">Contacto</h2>
            <dl className="mt-2 divide-y divide-ink-100">
              {row("Tipo", req.clientType === "empresa" ? "Empresa" : "Persona física")}
              {row("Correo", <a href={`mailto:${req.email}`} className="link">{req.email}</a>)}
              {row("Teléfono", <a href={`tel:${req.phone.replace(/[^\d+]/g, "")}`} className="link">{req.phone}</a>)}
              {row("Prefiere", req.preferredContact ? CONTACT_OPTIONS[req.preferredContact as keyof typeof CONTACT_OPTIONS] : null)}
              {row("Identificación", req.taxId ? `${ID_TYPES[req.idType as keyof typeof ID_TYPES] ?? ""} ${formatId(req.idType, req.taxId)}` : null)}
              {row("Nacimiento", req.birthDate ? formatDate(req.birthDate) : null)}
              {row("Estado civil", req.maritalStatus ? MARITAL_STATUS[req.maritalStatus as keyof typeof MARITAL_STATUS] : null)}
              {row("Dirección", req.address)}
            </dl>
            <p className="hint mt-2">Aceptó el aviso de protección de datos el {formatDateTime(req.consentAt)}.</p>
          </section>

          {status === "pendiente" && (
            <section className="card card-pad" aria-labelledby="descartar">
              <h2 id="descartar" className="font-semibold">Descartar</h2>
              <p className="mt-1 text-sm text-ink-600">Si no vas a llevar el caso. Se guarda la constancia de la revisión y la solicitud se borra sola a los 6 meses.</p>
              <ActionForm action={discardIntakeAction.bind(null, id)} className="mt-3 space-y-2">
                <textarea className="input min-h-20" name="note" maxLength={2000} placeholder="Motivo (interno): conflicto de interés, fuera de nuestras áreas, no respondió…" />
                <SubmitButton className="btn-secondary" pendingText="Descartando…">
                  Descartar solicitud
                </SubmitButton>
              </ActionForm>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
