import type { Metadata } from "next";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader, Pagination } from "@/components/ui";
import { db } from "@/db";
import { documents, matters, users } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { likePattern, pageParam, qs } from "@/lib/search";
import { DocumentsTable } from "./documents-table";

export const metadata: Metadata = { title: "Documentos" };
const PAGE_SIZE = 25;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = pageParam(sp.page);

  const search = q
    ? and(
        or(
          ilike(documents.name, likePattern(q)),
          ilike(documents.category, likePattern(q)),
          ilike(matters.number, likePattern(q)),
          ilike(matters.title, likePattern(q)),
        ),
      )
    : undefined;
  const where = and(search, matterAccessSql(user, matters.id));

  const [{ total }] = await db
    .select({ total: count() })
    .from(documents)
    .innerJoin(matters, eq(matters.id, documents.matterId))
    .where(where);

  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      category: documents.category,
      sizeBytes: documents.sizeBytes,
      createdAt: documents.createdAt,
      uploader: users.name,
      matterId: matters.id,
      matterNumber: matters.number,
    })
    .from(documents)
    .innerJoin(matters, eq(matters.id, documents.matterId))
    .leftJoin(users, eq(users.id, documents.uploadedById))
    .where(where)
    .orderBy(desc(documents.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Documentos"
        subtitle="Todos los documentos de los expedientes a los que tienes acceso."
        actions={
          <Link href="/documentos/subir" className="btn-primary">
            <Icon name="subir" className="h-4 w-4" />
            Subir documento
          </Link>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <input className="input max-w-sm" type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, categoría o expediente" />
        <button className="btn-secondary">Buscar</button>
        {q && (
          <Link href="/documentos" className="btn-ghost">
            Limpiar
          </Link>
        )}
      </form>
      <div className="card">
        <DocumentsTable rows={rows} user={user} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/documentos${qs({ q, page: p })}`} />
      </div>
    </>
  );
}
