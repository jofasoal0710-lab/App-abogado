import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { clients, matters } from "@/db/schema";
import { matterAccessSql } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { articleNumbersFrom } from "@/lib/law-parser";
import { articlesByNumber, getLaw } from "@/lib/laws";
import { citationText, getNorm } from "@/lib/normativa";
import { ArticleBody, articleLabel } from "../law-text";
import { citeArticleAction } from "../actions";

export const metadata: Metadata = { title: "Citar artículo" };

export default async function CitePage({ searchParams }: { searchParams: Promise<{ norma?: string; art?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const norm = getNorm(sp.norma);
  if (!norm) notFound();
  const art = (sp.art ?? "").slice(0, 60);
  const law = await getLaw(norm.key);
  const text = law ? await articlesByNumber(law.id, articleNumbersFrom(art)) : [];
  const options = await db
    .select({ id: matters.id, number: matters.number, title: matters.title, client: clients.name })
    .from(matters)
    .innerJoin(clients, eq(clients.id, matters.clientId))
    .where(and(inArray(matters.status, ["abierto", "en_curso", "en_espera"]), matterAccessSql(user, matters.id)))
    .orderBy(desc(matters.openedAt))
    .limit(300);
  return (
    <>
      <PageHeader title="Citar en un expediente" subtitle={citationText({ normName: norm.name, normNumber: norm.number, articles: art || null })} />
      <div className="grid gap-6 lg:grid-cols-5">
        <ActionForm action={citeArticleAction.bind(null, norm.key, art)} className="card card-pad lg:col-span-2">
          <Field label="Expediente">
            <select className="input" name="matterId" required defaultValue="">
              <option value="" disabled>
                Selecciona un expediente…
              </option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.number} · {m.title} ({m.client})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nota (opcional)" className="mt-3" hint="Para qué se cita">
            <input className="input" name="note" maxLength={1000} />
          </Field>
          <div className="mt-4 flex justify-between gap-2">
            <Link className="btn-secondary" href={law ? `/normativa/${norm.key}?art=${encodeURIComponent(art)}` : "/normativa"}>
              Cancelar
            </Link>
            <SubmitButton>Citar</SubmitButton>
          </div>
        </ActionForm>
        {text.length > 0 && (
          <section className="card card-pad lg:col-span-3">
            {text.map((a) => (
              <div key={a.id} className="mb-4 last:mb-0">
                <h2 className="mb-1 font-serif font-semibold">{articleLabel(a.number)}</h2>
                <ArticleBody body={a.body} />
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
