import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters } from "@/db/schema";
import { getAccessibleMatter, matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { initialValues } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { autoValues } from "@/lib/writings";
import { createWritingAction } from "../../escritos/actions";
import { WritingForm } from "../writing-form";

export const metadata: Metadata = { title: "Nuevo escrito" };

export default async function NewWritingPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ expediente?: string }> }) {
  const user = await requireUser();
  const tpl = getTemplate((await params).key);
  if (!tpl) notFound();
  const expId = Number((await searchParams).expediente);
  const matter = Number.isInteger(expId) && expId > 0 ? await getAccessibleMatter(user, expId) : null;

  // Un escrito de abogado siempre va enlazado a un expediente: si no viene, se elige primero.
  if (!matter && tpl.kind === "escrito") {
    const options = await db
      .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
      .from(matters)
      .innerJoin(clients, eq(clients.id, matters.clientId))
      .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id)))
      .orderBy(desc(matters.openedAt))
      .limit(500);
    return (
      <>
        <PageHeader title={tpl.title} subtitle="Primero, ¿a qué expediente pertenece este escrito?" />
        <form method="get" className="card card-pad flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1">
            <span className="label">Expediente</span>
            <select className="input" name="expediente" required defaultValue="">
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
          <button className="btn-primary">Continuar</button>
        </form>
      </>
    );
  }

  const values = initialValues(tpl, await autoValues(user, matter?.id ?? null));
  return (
    <>
      <PageHeader
        title={tpl.title}
        subtitle={matter ? `Para el expediente ${matter.number} · ${matter.title}` : "Escritura sin expediente: solo la verás tú."}
        actions={
          <Link href="/formularios" className="btn-secondary">
            Otros formularios
          </Link>
        }
      />
      <WritingForm
        action={createWritingAction.bind(null, tpl.key, matter?.id ?? null)}
        templateKey={tpl.key}
        fields={tpl.fields}
        values={values}
        title={matter ? `${tpl.title} · ${matter.number}` : tpl.title}
        submitLabel={tpl.kind === "escrito" ? "Generar escrito" : "Generar escritura"}
        cancelHref={matter ? `/expedientes/${matter.id}?tab=escritos` : "/formularios"}
      />
    </>
  );
}
