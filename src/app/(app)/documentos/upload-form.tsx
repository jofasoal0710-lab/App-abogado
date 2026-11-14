import { ActionForm, SubmitButton } from "@/components/form";
import { Field } from "@/components/ui";
import { uploadDocumentAction } from "./actions";

const CATEGORIES = ["Demanda / escrito", "Contrato", "Sentencia / resolución", "Prueba", "Correspondencia", "Identificación", "Otros"];

export function UploadForm({ matterId }: { matterId: number }) {
  return (
    <ActionForm action={uploadDocumentAction.bind(null, matterId)} resetOnSuccess className="card card-pad">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Archivo" className="sm:col-span-2" hint="Máximo 25 MB. PDF, Word, Excel, imágenes, correos…">
          <input className="input file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-2 file:py-1" type="file" name="file" required />
        </Field>
        <Field label="Categoría">
          <select className="input" name="category" defaultValue="">
            <option value="">Sin categoría</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <SubmitButton pendingText="Subiendo…">Subir documento</SubmitButton>
      </div>
    </ActionForm>
  );
}
