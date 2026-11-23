import { desc, eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { db } from "@/db";
import { portalLinks, type Matter } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/dates";
import { linkStatus } from "@/lib/portal-core";
import { createPortalLinkAction, revokePortalLinkAction, toggleMatterPortalAction } from "../portal-actions";

/** Portal del cliente (ficha del cliente): enlaces de acceso y qué expedientes se comparten. */
export async function PortalSection({ clientId, matters }: { clientId: number; matters: Matter[] }) {
  const links = await db.select().from(portalLinks).where(eq(portalLinks.clientId, clientId)).orderBy(desc(portalLinks.createdAt)).limit(20);
  const now = new Date();
  return (
    <section className="card card-pad lg:col-span-3" id="portal">
      <h2 className="mb-1 font-serif text-lg font-semibold">Portal del cliente</h2>
      <p className="mb-4 text-sm text-ink-600">
        El cliente entra con un enlace personal (sin contraseña) y solo ve los expedientes que compartas: su estado, las próximas audiencias, los documentos que marques uno a uno, el saldo de su provisión y sus facturas. Nunca ve notas, horas, escritos ni la aplicación del despacho.
      </p>

      <h3 className="label">Expedientes visibles en el portal</h3>
      {matters.length === 0 ? (
        <p className="mb-4 text-sm text-ink-500">Este cliente no tiene expedientes que puedas ver.</p>
      ) : (
        <ul className="mb-5 divide-y divide-ink-100 rounded-md border border-ink-100">
          {matters.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {m.number} · {m.title} {m.portalShared ? <span className="badge-green ml-1">Compartido</span> : <span className="badge-gray ml-1">No compartido</span>}
              </span>
              <form action={toggleMatterPortalAction.bind(null, m.id)}>
                <button className="btn-ghost btn-sm">{m.portalShared ? "Dejar de compartir" : "Compartir en el portal"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h3 className="label">Enlaces de acceso</h3>
      {links.length > 0 && (
        <table className="table mb-4">
          <tbody>
            {links.map((l) => {
              const st = linkStatus(l, now);
              return (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td className="whitespace-nowrap text-ink-600">
                    {st === "activo" ? `Válido hasta ${formatDate(l.expiresAt.toISOString().slice(0, 10))}` : st === "revocado" ? "Revocado" : "Caducado"}
                  </td>
                  <td className="whitespace-nowrap text-ink-500">{l.lastUsedAt ? `Último uso ${formatDateTime(l.lastUsedAt)}` : "Sin usar"}</td>
                  <td className="text-right">
                    {st === "activo" && (
                      <form action={revokePortalLinkAction.bind(null, l.id, clientId)}>
                        <ConfirmButton message={`¿Revocar el enlace de «${l.label}»? Dejará de funcionar al instante.`} className="btn-ghost btn-sm text-red-700">
                          Revocar
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ActionForm action={createPortalLinkAction.bind(null, clientId)} resetOnSuccess className="flex flex-wrap items-end gap-3">
        <Field label="Para quién" className="w-64">
          <input className="input" name="label" required maxLength={120} placeholder="Nombre de la persona" />
        </Field>
        <Field label="Válido (días)" className="w-32">
          <input className="input" name="days" inputMode="numeric" defaultValue="30" />
        </Field>
        <SubmitButton>Crear enlace</SubmitButton>
      </ActionForm>
      <p className="hint mt-2">El enlace se muestra una sola vez. Envíalo por un canal seguro; si se pierde o se comparte por error, revócalo y crea otro.</p>
    </section>
  );
}
