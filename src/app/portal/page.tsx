import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import { areaLabels, invoiceStatusLabels, matterStatusLabels } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { getPortalSession } from "@/lib/portal";
import { portalOverview } from "@/lib/portal-data";
import { portalLogoutAction } from "./actions";

export const metadata: Metadata = { title: "Portal del cliente" };
export const dynamic = "force-dynamic";

const dateTime = (d: Date) => d.toLocaleString(config.locale, { dateStyle: "full", timeStyle: "short", timeZone: process.env.TZ || "America/Costa_Rica" });

/** Portal del cliente: estado de sus asuntos, próximas audiencias, documentos compartidos y facturas. */
export default async function PortalPage() {
  const s = await getPortalSession();
  if (!s) redirect("/portal/caducado");
  const data = await portalOverview(s.clientId);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-serif text-lg font-semibold">{config.firmName}</p>
            <p className="text-xs text-ink-500">Portal del cliente · {s.clientName}</p>
          </div>
          <form action={portalLogoutAction}>
            <button className="btn-secondary btn-sm">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {data.matters.length === 0 && data.invoices.length === 0 && (
          <div className="card card-pad text-sm text-ink-600">Todavía no hay información compartida contigo. Tu abogado o abogada la irá publicando aquí.</div>
        )}

        {data.matters.map((m) => (
          <section key={m.id} className="card" aria-labelledby={`m${m.id}`}>
            <div className="border-b border-ink-100 px-5 py-3">
              <h2 id={`m${m.id}`} className="font-serif text-lg font-semibold">
                {m.title}
              </h2>
              <p className="text-sm text-ink-600">
                {m.number} · {areaLabels[m.area]} · <span className="badge-blue">{matterStatusLabels[m.status]}</span>
                {m.court ? ` · ${m.court}` : ""}
                {m.courtCaseNumber ? ` · Exp. judicial ${m.courtCaseNumber}` : ""}
              </p>
            </div>
            <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
              <div>
                <h3 className="label">Próximas audiencias</h3>
                {m.hearings.length === 0 ? (
                  <p className="text-sm text-ink-500">No hay audiencias programadas.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {m.hearings.map((h) => (
                      <li key={h.id} className="rounded-md border border-ink-100 p-2">
                        <p className="font-medium">{h.hearingType ?? h.title}</p>
                        <p className="text-ink-600">{dateTime(h.startsAt)}</p>
                        {h.location && <p className="text-ink-600">{h.location}</p>}
                        {h.meetingUrl && (
                          <a className="link" href={h.meetingUrl} target="_blank" rel="noopener noreferrer">
                            Enlace de la sala virtual
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="label">Documentos compartidos</h3>
                {m.documents.length === 0 ? (
                  <p className="text-sm text-ink-500">No hay documentos compartidos.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {m.documents.map((d) => (
                      <li key={d.id}>
                        <a className="link" href={`/api/portal/documentos/${d.id}`}>
                          {d.name}
                        </a>{" "}
                        <span className="text-xs text-ink-500">({Math.max(1, Math.round(d.sizeBytes / 1024))} KB)</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.fundsBalanceCents !== null && (
                  <p className="mt-4 text-sm">
                    Saldo de su provisión de fondos: <strong className="tabular-nums">{formatMoney(m.fundsBalanceCents)}</strong>
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}

        {data.invoices.length > 0 && (
          <section className="card">
            <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Facturas</h2>
            <ul className="divide-y divide-ink-100 sm:hidden">
              {data.invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {i.number} <span className={i.status === "pagada" ? "badge-green" : "badge-amber"}>{invoiceStatusLabels[i.status]}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatDate(i.issueDate)} · Total {formatMoney(i.totalCents)}
                      {i.outstandingCents > 0 ? ` · Pendiente ${formatMoney(i.outstandingCents)}` : ""}
                    </p>
                  </div>
                  <a className="btn-secondary btn-sm" href={`/api/portal/facturas/${i.id}`}>
                    PDF
                  </a>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pendiente</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.number} <span className={i.status === "pagada" ? "badge-green" : "badge-amber"}>{invoiceStatusLabels[i.status]}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(i.issueDate)}
                        {i.dueDate && i.status !== "pagada" ? <span className="block text-xs text-ink-500">Vence {formatDate(i.dueDate)}</span> : null}
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(i.totalCents)}</td>
                      <td className="text-right tabular-nums">{formatMoney(i.outstandingCents)}</td>
                      <td>
                        <a className="btn-ghost btn-sm" href={`/api/portal/facturas/${i.id}`}>
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="text-center text-xs text-ink-500">Este portal es solo de consulta. Para cualquier gestión, comunícate con el despacho.</p>
      </main>
    </div>
  );
}
