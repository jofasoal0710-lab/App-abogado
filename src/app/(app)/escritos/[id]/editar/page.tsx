import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { initialValues } from "@/lib/forms/engine";
import { getTemplate } from "@/lib/forms/templates";
import { autoValues, getAccessibleWriting } from "@/lib/writings";
import { updateWritingAction } from "../../actions";
import { WritingForm } from "../../../formularios/writing-form";

export const metadata: Metadata = { title: "Corregir escrito" };

/** «Corregir» vuelve siempre a los campos con lo que se escribió, para cambiar lo que haga falta. */
export default async function EditWritingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const w = await getAccessibleWriting(user, id);
  if (!w) notFound();
  const tpl = getTemplate(w.templateKey);
  if (!tpl) notFound();
  const values = initialValues(tpl, await autoValues(user, w.matterId), w.values);
  return (
    <>
      <PageHeader title={`Corregir: ${w.title}`} subtitle="Cambia los campos y guarda: el documento se vuelve a redactar." />
      <WritingForm
        action={updateWritingAction.bind(null, w.id)}
        fields={tpl.fields}
        values={values}
        title={w.title}
        submitLabel="Guardar cambios"
        cancelHref={`/escritos/${w.id}`}
      />
    </>
  );
}
