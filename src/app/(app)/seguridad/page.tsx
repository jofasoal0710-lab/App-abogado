import type { Metadata } from "next";
import { appLocale } from "@/lib/locale";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { db } from "@/db";
import { securityEvents, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { isClientIpTrusted } from "@/lib/client-ip";
import { NOTABLE_EVENTS, SECURITY_EVENT_LABELS, type SecurityEventKind } from "@/lib/security-events";
import { SECURITY_LOG_RETENTION_DAYS } from "@/lib/security-log";

export const metadata: Metadata = { title: "Seguridad" };

const LIMIT = 300;

/** Cabeceras en las que distintas plataformas ponen la IP del visitante. */
const IP_HEADERS = ["true-client-ip", "cf-connecting-ip", "x-real-ip", "x-forwarded-for", "x-nf-client-connection-ip", "fly-client-ip", "x-client-ip", "forwarded"];

export default async function SecurityLogPage({ searchParams }: { searchParams: Promise<{ usuario?: string; tipo?: string }> }) {
  const viewer = await requirePermission("seguridad.ver");
  const sp = await searchParams;
  const userId = Number(sp.usuario);
  const onlyNotable = sp.tipo === "importantes";

  const actor = alias(users, "actor");
  const target = alias(users, "target");
  const filters: SQL[] = [];
  if (Number.isInteger(userId) && userId > 0) filters.push(eq(securityEvents.targetId, userId));
  if (onlyNotable) filters.push(inArray(securityEvents.kind, [...NOTABLE_EVENTS]));

  const rows = await db
    .select({
      id: securityEvents.id,
      at: securityEvents.at,
      kind: securityEvents.kind,
      email: securityEvents.email,
      ip: securityEvents.ip,
      detail: securityEvents.detail,
      actorId: securityEvents.actorId,
      targetId: securityEvents.targetId,
      actorName: actor.name,
      targetName: target.name,
    })
    .from(securityEvents)
    .leftJoin(actor, eq(actor.id, securityEvents.actorId))
    .leftJoin(target, eq(target.id, securityEvents.targetId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(securityEvents.at), desc(securityEvents.id))
    .limit(LIMIT);
  const people = await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
  const h = await headers();
  const ipHeaders = IP_HEADERS.map((name) => [name, h.get(name)] as const).filter(([, v]) => v);
  const configured = process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || null;

  return (
    <>
      <PageHeader
        title="Registro de seguridad"
        subtitle={`Inicios de sesión, contraseñas y cambios en las cuentas. Se conservan ${SECURITY_LOG_RETENTION_DAYS} días; nunca incluye contraseñas.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/seguridad/cambios" className="btn-secondary">Cambios y borrados</Link>
            {can(viewer, "equipo.gestionar") && <Link href="/seguridad/respaldos" className="btn-secondary">Copias de seguridad</Link>}
          </div>
        }
      />

      <details className="card mb-6 text-sm" open={!isClientIpTrusted()}>
        <summary className="cursor-pointer px-5 py-3 font-medium text-ink-900">
          Detección de la IP de origen:{" "}
          {configured ? (
            <span className="badge-green">cabecera «{configured}»</span>
          ) : (
            <span className="badge-amber">sin configurar</span>
          )}
        </summary>
        <div className="space-y-3 border-t border-ink-100 px-5 py-4 text-ink-700">
          <p>
            {configured
              ? "Las IP del registro y el límite de intentos por IP usan esa cabecera."
              : "Sin CLIENT_IP_HEADER, la IP que se anota puede estar falseada y el límite de intentos por IP entre varias cuentas está desactivado (los límites por correo siguen activos)."}{" "}
            Para elegirla: busca tu IP pública (por ejemplo, «cuál es mi IP» en un buscador) y mira abajo qué cabecera la contiene
            <strong> sola</strong>. Esa es la que pone la plataforma: añádela en Render como <code>CLIENT_IP_HEADER</code>. Evita{" "}
            <code>x-forwarded-for</code> si trae varias IP: la primera la puede escribir cualquiera.
          </p>
          <table className="text-xs">
            <tbody>
              {ipHeaders.length === 0 && (
                <tr>
                  <td className="text-ink-500">Esta petición no trae ninguna cabecera de IP conocida.</td>
                </tr>
              )}
              {ipHeaders.map(([name, value]) => (
                <tr key={name}>
                  <td className="py-0.5 pr-4 font-mono">{name}</td>
                  <td className="py-0.5 font-mono text-ink-900">{value}</td>
                  <td className="py-0.5 pl-3">{name === configured && <span className="badge-green">en uso</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <form className="card card-pad mb-6 flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-ink-600">Cuenta</span>
          <select className="input" name="usuario" defaultValue={sp.usuario ?? ""}>
            <option value="">Todas</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" name="tipo" value="importantes" defaultChecked={onlyNotable} />
          Solo eventos importantes
        </label>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Evento</th>
              <th className="px-4 py-2">Cuenta</th>
              <th className="px-4 py-2">Hecho por</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-500">
                  No hay eventos con estos filtros.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const kind = r.kind as SecurityEventKind;
              return (
                <tr key={r.id} className={NOTABLE_EVENTS.has(kind) ? "bg-amber-50/40" : undefined}>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-600">
                    {r.at.toLocaleString(appLocale(), { dateStyle: "short", timeStyle: "medium" })}
                  </td>
                  <td className="px-4 py-2">
                    {NOTABLE_EVENTS.has(kind) ? (
                      <span className="badge-amber">{SECURITY_EVENT_LABELS[kind] ?? r.kind}</span>
                    ) : (
                      (SECURITY_EVENT_LABELS[kind] ?? r.kind)
                    )}
                  </td>
                  <td className="px-4 py-2">{r.targetName ?? <span className="text-ink-500">{r.email ?? "—"}</span>}</td>
                  <td className="px-4 py-2 text-ink-600">{r.actorId && r.actorId !== r.targetId ? r.actorName : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-ink-600">{r.ip ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-600">{r.detail ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === LIMIT && <p className="mt-2 text-xs text-ink-500">Se muestran los {LIMIT} eventos más recientes; usa los filtros para acotar.</p>}
    </>
  );
}
