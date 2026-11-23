import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { dataAudit, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { appLocale } from "@/lib/locale";

export const metadata: Metadata = { title: "Registro de cambios" };

const TABLES: Record<string, string> = {
  clients: "Cliente", matters: "Expediente", matter_notes: "Nota", matter_members: "Acceso a expediente", events: "Evento / plazo",
  time_entries: "Horas", invoices: "Factura", invoice_items: "Línea de factura", payments: "Cobro", documents: "Documento",
  writings: "Escrito", matter_citations: "Norma citada", matter_expenses: "Gasto", matter_fee_stages: "Etapa de cobro",
  deeds: "Escritura", deed_parties: "Compareciente", testimonies: "Testimonio", notary_profiles: "Perfil notarial",
  notary_index_submissions: "Índice notarial", registry_checks: "Consulta registral", knowledge_entries: "Conocimiento",
  fee_services: "Servicio del tarifario", fee_settings: "Ajustes de tarifas", roles: "Rol", users: "Cuenta",
  einvoices: "Factura electrónica", einvoice_settings: "Ajustes de Hacienda",
};

/** Un título legible de la fila borrada, sin mostrar su contenido. */
function label(data: Record<string, unknown>): string {
  const pick = (k: string) => (typeof data[k] === "string" && data[k] ? String(data[k]).slice(0, 80) : "");
  const main = pick("title") || pick("name") || pick("period");
  return [pick("number") || pick("consecutive"), main].filter(Boolean).join(" · ");
}

export default async function DataAuditPage({ searchParams }: { searchParams: Promise<{ tipo?: string; tabla?: string }> }) {
  await requirePermission("seguridad.ver");
  const sp = await searchParams;
  const filters: SQL[] = [];
  if (sp.tipo === "borrado" || sp.tipo === "cambio") filters.push(eq(dataAudit.op, sp.tipo));
  if (sp.tabla && TABLES[sp.tabla]) filters.push(eq(dataAudit.tableName, sp.tabla));
  const rows = await db
    .select({ id: dataAudit.id, at: dataAudit.at, table: dataAudit.tableName, op: dataAudit.op, rowId: dataAudit.rowId, data: dataAudit.data, actor: users.name })
    .from(dataAudit)
    .leftJoin(users, eq(users.id, dataAudit.actorId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(dataAudit.at), desc(dataAudit.id))
    .limit(300);
  const q = (p: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ tipo: sp.tipo, tabla: sp.tabla, ...p }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Registro de cambios y borrados"
        subtitle="Quién cambió o borró qué y cuándo, en cualquier parte de la app (también los borrados en cascada). Se conserva un año y no se puede modificar."
        actions={<Link href="/seguridad" className="btn-secondary">Registro de seguridad</Link>}
      />
      <p className="mb-4 rounded-md border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
        Por confidencialidad aquí solo se ven los campos que cambiaron, no sus valores. La base de datos guarda la fila borrada completa: si hace falta recuperar algo, pídelo a quien administra la base de datos indicando el n.º de registro.
      </p>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className={!sp.tipo ? "btn-primary btn-sm" : "btn-secondary btn-sm"} href={q({ tipo: undefined })}>Todo</Link>
        <Link className={sp.tipo === "borrado" ? "btn-primary btn-sm" : "btn-secondary btn-sm"} href={q({ tipo: "borrado" })}>Solo borrados</Link>
        <Link className={sp.tipo === "cambio" ? "btn-primary btn-sm" : "btn-secondary btn-sm"} href={q({ tipo: "cambio" })}>Solo cambios</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-2">N.º</th><th className="px-4 py-2">Cuándo</th><th className="px-4 py-2">Quién</th><th className="px-4 py-2">Qué</th><th className="px-4 py-2">Detalle</th></tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const d = r.data as Record<string, unknown>;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-500">{r.id}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.at.toLocaleString(appLocale(), { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-2">{r.actor ?? <span className="text-ink-500">Sistema / sin identificar</span>}</td>
                  <td className="px-4 py-2">
                    {r.op === "borrado" ? <span className="badge-red mr-1">Borrado</span> : <span className="badge-blue mr-1">Cambio</span>}
                    <Link href={q({ tabla: r.table })} className="hover:underline">{TABLES[r.table] ?? r.table}</Link> <span className="text-ink-500">#{r.rowId}</span>
                  </td>
                  <td className="px-4 py-2 text-ink-700">{r.op === "borrado" ? label(d) : `Campos: ${Object.keys(d).join(", ")}`}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-500">Sin registros.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
