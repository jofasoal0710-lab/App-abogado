import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { documents, matters, users } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { docxToSafeHtml, matchesSignature, MAX_VIEW_BYTES, viewKind } from "@/lib/doc-viewer";
import { formatBytes } from "@/lib/file-types";
import { logRead } from "@/lib/read-audit";
import { readStoredFile } from "@/lib/storage";

export const metadata: Metadata = { title: "Documento" };

/** Ver un documento sin descargarlo: PDF, imágenes, Word (.docx) y texto. */
export default async function DocumentViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db
    .select({ d: documents, matterNumber: matters.number, matterTitle: matters.title, uploader: users.name })
    .from(documents)
    .innerJoin(matters, eq(matters.id, documents.matterId))
    .leftJoin(users, eq(users.id, documents.uploadedById))
    .where(and(eq(documents.id, id), matterAccessSql(user, documents.matterId)))
    .limit(1);
  if (!row) notFound();
  const d = row.d;
  await logRead(user, { matterId: d.matterId, kind: "documento", detail: `Ver ${d.name}` });

  const kind = viewKind(d.name);
  let wordHtml: string | null = null;
  let text: string | null = null;
  let problem: string | null = null;
  if (kind === "word" || kind === "text") {
    const data = await readStoredFile(d.storageKey, MAX_VIEW_BYTES);
    if (!data) problem = "El archivo no está disponible o es demasiado grande para verlo aquí.";
    else if (!matchesSignature(kind, d.name, data)) problem = "El contenido no corresponde a un documento de Word; descárgalo para revisarlo.";
    else if (kind === "word") {
      try {
        wordHtml = await docxToSafeHtml(data);
      } catch {
        problem = "No se pudo leer este documento de Word. Descárgalo para abrirlo.";
      }
    } else text = data.toString("utf8").slice(0, 500_000);
  }

  return (
    <>
      <PageHeader
        title={d.name}
        subtitle={
          <span>
            <Link className="link" href={`/expedientes/${d.matterId}?tab=documentos`}>
              {row.matterNumber}
            </Link>{" "}
            · {row.matterTitle} · {formatBytes(d.sizeBytes)} · {row.uploader ?? "—"} · {formatDate(d.createdAt)}
          </span>
        }
        actions={
          <>
            {(kind === "pdf" || kind === "image") && (
              <a className="btn-secondary" href={`/api/documentos/${d.id}/ver`} target="_blank" rel="noopener noreferrer">
                Abrir en otra pestaña
              </a>
            )}
            <a className="btn-primary" href={`/api/documentos/${d.id}`}>
              Descargar
            </a>
          </>
        }
      />
      {problem && (
        <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {problem}
        </p>
      )}
      {kind === "pdf" && (
        <div className="card overflow-hidden">
          <iframe title={`Vista de ${d.name}`} src={`/api/documentos/${d.id}/ver#view=FitH`} className="h-[80vh] w-full border-0" />
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">Si tu navegador no muestra el PDF aquí (algunos móviles), usa «Abrir en otra pestaña» o «Descargar».</p>
        </div>
      )}
      {kind === "image" && (
        <div className="card flex justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/documentos/${d.id}/ver`} alt={d.name} className="max-h-[80vh] max-w-full object-contain" />
        </div>
      )}
      {wordHtml !== null && (
        <article className="paper card mx-auto max-w-3xl bg-white px-8 py-10 font-serif text-[15px] leading-relaxed text-ink-900 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-ink-200 [&_td]:p-1.5 [&_ul]:list-disc">
          <p className="mb-4 font-sans text-xs text-ink-500">Vista del contenido del Word (sin el formato exacto de página). Para la versión original, descárgalo.</p>
          <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
        </article>
      )}
      {text !== null && <pre className="card overflow-x-auto whitespace-pre-wrap p-5 text-sm text-ink-800">{text}</pre>}
      {kind === null && (
        <EmptyState title="Este tipo de archivo no se puede ver aquí">Se pueden ver PDF, imágenes, Word (.docx) y texto. Descárgalo para abrirlo con su programa.</EmptyState>
      )}
    </>
  );
}
