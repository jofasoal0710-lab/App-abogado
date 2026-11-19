import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters } from "@/db/schema";
import { getAccessibleMatter, matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { UploadForm } from "../upload-form";

export const metadata: Metadata = { title: "Subir documento" };

/**
 * Subir un documento desde la sección Documentos: primero se elige el expediente (solo los que el
 * usuario puede ver) y después se muestra el mismo formulario que en la pestaña del expediente, que
 * vuelve a comprobar el acceso en el servidor.
 */
export default async function UploadDocumentPage({ searchParams }: { searchParams: Promise<{ expediente?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const id = Number(sp.expediente);
  const matter = Number.isInteger(id) && id > 0 ? await getAccessibleMatter(user, id) : null;

  const options = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt), desc(matters.id))
    .limit(500);

  return (
    <>
      <PageHeader
        title="Subir documento"
        subtitle="Cada documento se guarda dentro de un expediente. Elige primero a cuál pertenece."
        actions={
          <Link href="/documentos" className="btn-secondary">
            Volver a documentos
          </Link>
        }
      />

      <form className="card card-pad mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="block min-w-0 flex-1">
          <span className="label">Expediente</span>
          <select className="input" name="expediente" defaultValue={matter ? String(matter.id) : ""} required>
            <option value="" disabled>
              Selecciona un expediente…
            </option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.number} · {m.title} ({m.client})
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">{matter ? "Cambiar" : "Continuar"}</button>
      </form>

      {options.length === 0 && !matter && (
        <p className="card card-pad text-sm text-ink-600">
          No tienes expedientes activos.{" "}
          <Link href="/expedientes/nuevo" className="link">
            Abre uno
          </Link>{" "}
          para poder subir documentos.
        </p>
      )}

      {sp.expediente && !matter && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Ese expediente no existe o no tienes acceso a él.
        </p>
      )}

      {matter && (
        <section>
          <h2 className="mb-3 text-sm text-ink-600">
            Se guardará en{" "}
            <Link href={`/expedientes/${matter.id}?tab=documentos`} className="link">
              {matter.number} · {matter.title}
            </Link>
          </h2>
          <UploadForm matterId={matter.id} />
        </section>
      )}
    </>
  );
}
