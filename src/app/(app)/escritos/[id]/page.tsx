import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/form";
import { LegalDocument } from "@/components/legal-document";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { matters } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { getTemplate } from "@/lib/forms/templates";
import { logRead } from "@/lib/read-audit";
import { getAccessibleWriting } from "@/lib/writings";
import { deleteWritingAction } from "../actions";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Escrito" };

export default async function WritingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string; guardado?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const w = await getAccessibleWriting(user, id);
  if (!w) notFound();
  const tpl = getTemplate(w.templateKey);
  const sp = await searchParams;
  const [matter] = w.matterId ? await db.select({ id: matters.id, number: matters.number }).from(matters).where(eq(matters.id, w.matterId)) : [];
  if (w.matterId) await logRead(user, { matterId: w.matterId, kind: "documento", detail: `Escrito: ${w.title}` });

  return (
    <>
      <PageHeader
        title={w.title}
        subtitle={
          <>
            {tpl?.title ?? w.templateKey}
            {matter && (
              <>
                {" · "}
                <Link href={`/expedientes/${matter.id}?tab=escritos`} className="link">
                  {matter.number}
                </Link>
              </>
            )}
            {` · actualizado ${formatDateTime(w.updatedAt)}`}
          </>
        }
        actions={
          <>
            <Link href={`/escritos/${w.id}/editar`} className="btn-secondary">
              Corregir
            </Link>
            <a href={`/api/escritos/${w.id}/doc`} className="btn-secondary">
              Descargar Word
            </a>
            <PrintButton />
          </>
        }
      />
      {(sp.creado || sp.guardado) && (
        <p role="status" className="no-print mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {sp.creado ? "Documento generado." : "Cambios guardados."} Revísalo; si algo no está bien, pulsa «Corregir» para volver a los campos.
        </p>
      )}
      {tpl ? (
        <div className="card overflow-hidden">
          <LegalDocument blocks={tpl.render(w.values)} />
        </div>
      ) : (
        <p className="card card-pad text-sm text-ink-600">El formulario de este escrito ya no existe.</p>
      )}
      <form action={deleteWritingAction.bind(null, w.id)} className="no-print mt-4">
        <ConfirmButton message="¿Eliminar este escrito? No se puede deshacer." className="btn-ghost btn-sm text-red-700">
          Eliminar escrito
        </ConfirmButton>
      </form>
    </>
  );
}
