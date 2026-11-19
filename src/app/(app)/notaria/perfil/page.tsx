import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getNotaryProfile } from "@/lib/notary";
import { saveNotaryProfileAction } from "../actions";
import { NotaryNav } from "../notary-nav";

export const metadata: Metadata = { title: "Perfil de notario" };

export default async function NotaryProfilePage() {
  const user = await requirePermission("notaria.usar");
  const p = await getNotaryProfile(user.id);
  return (
    <>
      <PageHeader title="Gestor notarial" subtitle="Tus datos de notario: salen en las escrituras y en el índice." />
      <NotaryNav current="/notaria/perfil" />
      <ActionForm action={saveNotaryProfileAction} className="card card-pad">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <input className="input" name="fullName" defaultValue={p?.fullName ?? user.name} required maxLength={200} />
          </Field>
          <Field label="Cédula">
            <input className="input" name="idNumber" defaultValue={p?.idNumber ?? ""} maxLength={40} />
          </Field>
          <Field label="Carné del Colegio de Abogados">
            <input className="input" name="barNumber" defaultValue={p?.barNumber ?? ""} maxLength={40} />
          </Field>
          <Field label="Oficina (lugar donde se otorgan las escrituras)">
            <input className="input" name="office" defaultValue={p?.office ?? ""} maxLength={300} />
          </Field>
          <Field label="Teléfono">
            <input className="input" name="phone" defaultValue={p?.phone ?? ""} maxLength={40} />
          </Field>
          <Field label="Correo">
            <input className="input" name="email" type="email" defaultValue={p?.email ?? user.email} maxLength={200} />
          </Field>
          <Field label="Tomo del protocolo en uso">
            <input className="input" name="currentVolume" defaultValue={p?.currentVolume ?? ""} maxLength={20} />
          </Field>
          <Field label="Folio por el que va" hint="Se actualiza solo al registrar escrituras con su folio final.">
            <input className="input" name="nextFolio" inputMode="numeric" defaultValue={p?.nextFolio ?? 1} required />
          </Field>
        </div>
        <div className="mt-4">
          <SubmitButton>Guardar perfil</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
