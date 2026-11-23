import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { backupRuns } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { backupKeep, listBackupObjects } from "@/lib/backup";
import { appLocale } from "@/lib/locale";
import { storageDriver } from "@/lib/storage";
import { backupNowAction } from "./actions";

export const metadata: Metadata = { title: "Copias de seguridad" };

export default async function BackupsPage() {
  await requirePermission("equipo.gestionar");
  const runs = await db.select().from(backupRuns).orderBy(desc(backupRuns.at)).limit(20);
  const keys = (await listBackupObjects().catch(() => [] as string[])).reverse();
  const lastOk = runs.find((r) => r.ok);
  const stale = !lastOk || Date.now() - lastOk.at.getTime() > 48 * 3600_000;
  const fmt = (d: Date) => d.toLocaleString(appLocale(), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PageHeader
        title="Copias de seguridad"
        subtitle={`Una copia completa de la base de datos al día, guardada en el almacenamiento de documentos (${storageDriver() === "s3" ? "bucket S3" : "disco local"}). Se conservan las últimas ${backupKeep()}.`}
        actions={<Link href="/seguridad" className="btn-secondary">Registro de seguridad</Link>}
      />
      <div className={`mb-6 rounded-md border px-4 py-3 text-sm ${stale ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        {lastOk ? `Última copia correcta: ${fmt(lastOk.at)} (${lastOk.rows} filas).` : "Todavía no hay ninguna copia correcta."}
        {stale && " Revisa el planificador o crea una ahora."}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-2 font-serif text-lg font-semibold">Crear una copia ahora</h2>
          <ActionForm action={backupNowAction}>
            <SubmitButton pendingText="Creando copia…">Crear copia</SubmitButton>
          </ActionForm>
        </section>
        <section className="card card-pad text-sm text-ink-700">
          <h2 className="mb-2 font-serif text-lg font-semibold">Guarda una copia fuera</h2>
          <p>
            Las copias están en el mismo proveedor que la base de datos. Descarga una al menos cada semana y guárdala cifrada fuera (p. ej. en un disco del despacho): contiene todos los datos de clientes y expedientes, incluidos los confidenciales. Cada descarga queda en el registro de seguridad.
          </p>
          <p className="mt-2">Restaurar: <code className="text-xs">npm run db:restore -- fichero.json.gz</code> (ver la guía de despliegue).</p>
        </section>
      </div>
      <section className="card mb-6">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Copias disponibles ({keys.length})</h2>
        <ul className="divide-y divide-ink-100 text-sm">
          {keys.map((k) => (
            <li key={k} className="flex items-center justify-between px-5 py-2">
              <span className="font-mono text-xs">{k.replace("respaldos/", "")}</span>
              <a className="btn-secondary btn-sm" href={`/api/respaldos?clave=${encodeURIComponent(k)}`}>Descargar</a>
            </li>
          ))}
          {keys.length === 0 && <li className="px-5 py-4 text-ink-500">Ninguna todavía.</li>}
        </ul>
      </section>
      <section className="card">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Últimas ejecuciones</h2>
        <ul className="divide-y divide-ink-100 text-sm">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 px-5 py-2">
              <span>{fmt(r.at)}</span>
              <span>{r.ok ? <span className="badge-green">Correcta · {r.rows} filas · {Math.round((r.bytes ?? 0) / 1024)} KB</span> : <span className="badge-red">Error: {r.error}</span>}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
