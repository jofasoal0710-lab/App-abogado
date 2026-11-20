import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/form";
import { LegalDocument } from "@/components/legal-document";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { deeds, matters } from "@/db/schema";
import { and } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { getTemplate } from "@/lib/forms/templates";
import { logRead } from "@/lib/read-audit";
import { getAccessibleWriting } from "@/lib/writings";
import { deleteWritingAction } from "../actions";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Escrito" };

export default async function WritingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string; guardado?: string; vista?: string; revisar?: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const w = await getAccessibleWriting(user, id);
  if (!w) notFound();
  const tpl = getTemplate(w.templateKey);
  const sp = await searchParams;
  const vista = sp.vista === "pdf" || sp.vista === "word" ? sp.vista : "documento";
  const [matter] = w.matterId ? await db.select({ id: matters.id, number: matters.number }).from(matters).where(eq(matters.id, w.matterId)) : [];
  const [deed] = await db.select({ id: deeds.id, number: deeds.number }).from(deeds).where(and(eq(deeds.writingId, w.id), eq(deeds.notaryId, user.id)));
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
            {deed && (
              <Link href={`/notaria/escrituras/${deed.id}`} className="btn-secondary">
                Protocolo · N.º {deed.number}
              </Link>
            )}
            <Link href={`/escritos/${w.id}/editar`} className="btn-secondary">
              Corregir
            </Link>
            <a href={`/api/escritos/${w.id}/doc`} className="btn-secondary">
              Descargar Word
            </a>
            <a href={`/api/escritos/${w.id}/pdf`} className="btn-secondary">
              Descargar PDF
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
      {tpl && (
        <nav aria-label="Vista" className="no-print mb-3 flex gap-1 border-b border-ink-200">
          {(
            [
              ["documento", "Documento"],
              ["pdf", "Vista PDF"],
              ["word", "Vista Word"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={`/escritos/${w.id}${k === "documento" ? "" : `?vista=${k}`}`}
              aria-current={vista === k ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${vista === k ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {tpl && vista === "documento" && (
        <div className="card overflow-hidden">
          <LegalDocument blocks={tpl.render(w.values)} />
        </div>
      )}
      {tpl && vista !== "documento" && (
        <div className="card overflow-hidden">
          <iframe
            title={vista === "pdf" ? "Vista del PDF" : "Vista del Word"}
            src={`/api/escritos/${w.id}/ver?formato=${vista}`}
            className="h-[85vh] w-full border-0 bg-ink-100"
          />
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
            {vista === "pdf"
              ? "Así queda el PDF (carta, Times 12, márgenes de 2,5 cm). Si tu navegador no lo muestra aquí, usa «Descargar PDF»."
              : "Así se abrirá en Word (carta, Times New Roman 12, márgenes de 2,5 cm). En Word puedes editarlo y guardarlo como .docx."}
          </p>
        </div>
      )}
      {!tpl && (
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
